import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { nextPublicId } from "../../utils/idGenerator";
import { asyncHandler } from "../../utils/asyncHandler";

export const coursesRouter = Router();

coursesRouter.use(requireAuth);

coursesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const departmentId = req.query.departmentId as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (!includeInactive) conditions.push("c.is_active = true");
    if (departmentId) {
      params.push(departmentId);
      conditions.push(`c.department_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT c.id, c.public_id, c.name, c.duration_years, c.is_active,
              c.department_id, d.name AS department_name
       FROM courses c
       JOIN departments d ON d.id = c.department_id
       ${where}
       ORDER BY c.name ASC`,
      params
    );
    res.json({ success: true, data: rows });
  })
);

const createSchema = z.object({
  name: z.string().min(2).max(150),
  departmentId: z.number().int().positive(),
  durationYears: z.number().int().min(1).max(10).default(3),
});

coursesRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid course payload", parsed.error.flatten());
    }

    const { rows: dept } = await pool.query("SELECT id FROM departments WHERE id = $1 AND is_active = true", [
      parsed.data.departmentId,
    ]);
    if (dept.length === 0) throw new ApiError(422, "INVALID_DEPARTMENT", "Department does not exist or is inactive");

    const result = await withTransaction(async (client) => {
      const publicId = await nextPublicId(client, "course", "CRS");
      const { rows } = await client.query(
        `INSERT INTO courses (public_id, department_id, name, duration_years)
         VALUES ($1, $2, $3, $4)
         RETURNING id, public_id, name, duration_years, is_active, department_id`,
        [publicId, parsed.data.departmentId, parsed.data.name, parsed.data.durationYears]
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json)
         VALUES ($1, 'CREATE', 'course', $2, $3::jsonb)`,
        [req.user!.userId, publicId, JSON.stringify(rows[0])]
      );
      return rows[0];
    });

    res.status(201).json({ success: true, data: result });
  })
);

coursesRouter.patch(
  "/:id/status",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required");

    const { rows: before } = await pool.query("SELECT * FROM courses WHERE id = $1", [req.params.id]);
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Course not found");

    const { rows } = await pool.query(
      `UPDATE courses SET is_active = $1 WHERE id = $2
       RETURNING id, public_id, name, duration_years, is_active, department_id`,
      [parsed.data.isActive, req.params.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'STATUS_CHANGE', 'course', $2, $3::jsonb, $4::jsonb)`,
      [req.user!.userId, before[0].public_id, JSON.stringify(before[0]), JSON.stringify(rows[0])]
    );

    res.json({ success: true, data: rows[0] });
  })
);
