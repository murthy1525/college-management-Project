import { Router } from "express";
import { z } from "zod";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { nextPublicId } from "../../utils/idGenerator";
import { asyncHandler } from "../../utils/asyncHandler";

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const { rows } = await pool.query(
      `SELECT id, public_id, name, is_active, created_at, updated_at
       FROM departments
       ${includeInactive ? "" : "WHERE is_active = true"}
       ORDER BY name ASC`
    );
    res.json({ success: true, data: rows });
  })
);

const createSchema = z.object({
  name: z.string().min(2).max(150),
});

departmentsRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid department payload", parsed.error.flatten());
    }

    const result = await withTransaction(async (client) => {
      const publicId = await nextPublicId(client, "department", "DEPT");
      const { rows } = await client.query(
        `INSERT INTO departments (public_id, name) VALUES ($1, $2)
         RETURNING id, public_id, name, is_active, created_at, updated_at`,
        [publicId, parsed.data.name]
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json)
         VALUES ($1, 'CREATE', 'department', $2, $3::jsonb)`,
        [req.user!.userId, publicId, JSON.stringify(rows[0])]
      );
      return rows[0];
    });

    res.status(201).json({ success: true, data: result });
  })
);

const updateSchema = z.object({
  name: z.string().min(2).max(150),
});

departmentsRouter.put(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid department payload", parsed.error.flatten());
    }

    const { rows: before } = await pool.query("SELECT * FROM departments WHERE id = $1", [req.params.id]);
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Department not found");

    const { rows } = await pool.query(
      `UPDATE departments SET name = $1, updated_at = now() WHERE id = $2
       RETURNING id, public_id, name, is_active, created_at, updated_at`,
      [parsed.data.name, req.params.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'UPDATE', 'department', $2, $3::jsonb, $4::jsonb)`,
      [req.user!.userId, before[0].public_id, JSON.stringify(before[0]), JSON.stringify(rows[0])]
    );

    res.json({ success: true, data: rows[0] });
  })
);

departmentsRouter.patch(
  "/:id/status",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required");
    }

    const { rows: before } = await pool.query("SELECT * FROM departments WHERE id = $1", [req.params.id]);
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Department not found");

    const { rows } = await pool.query(
      `UPDATE departments SET is_active = $1, updated_at = now() WHERE id = $2
       RETURNING id, public_id, name, is_active, created_at, updated_at`,
      [parsed.data.isActive, req.params.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'STATUS_CHANGE', 'department', $2, $3::jsonb, $4::jsonb)`,
      [req.user!.userId, before[0].public_id, JSON.stringify(before[0]), JSON.stringify(rows[0])]
    );

    res.json({ success: true, data: rows[0] });
  })
);
