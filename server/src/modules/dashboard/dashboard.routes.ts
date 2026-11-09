import { Router } from "express";
import { pool } from "../../config/db";
import { requireAuth } from "../../middleware/auth.middleware";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/summary", async (_req, res) => {
  const [students, lecturers, departments, courses, recentAudit] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active,
         COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
       FROM students`
    ),
    pool.query(`SELECT to_regclass('lecturers') IS NOT NULL AS exists`),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active
       FROM departments`
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active
       FROM courses`
    ),
    pool.query(
      `SELECT id, action, entity_type, entity_id, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 10`
    ),
  ]);

  res.json({
    success: true,
    data: {
      students: students.rows[0],
      lecturers: lecturers.rows[0].exists ? null : { total: 0, active: 0, note: "module not yet implemented" },
      departments: departments.rows[0],
      courses: courses.rows[0],
      recentActivity: recentAudit.rows,
    },
  });
});
