import { Queryable } from "../../config/db";

export interface StatusCounts {
  total: number;
  active: number;
  inactive?: number;
}

export async function studentCounts(db: Queryable): Promise<StatusCounts> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active = true)::int AS active,
            COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
     FROM students`
  );
  return rows[0];
}

export async function departmentCounts(db: Queryable): Promise<StatusCounts> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active = true)::int AS active
     FROM departments`
  );
  return rows[0];
}

export async function courseCounts(db: Queryable): Promise<StatusCounts> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_active = true)::int AS active
     FROM courses`
  );
  return rows[0];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export async function recentActivity(db: Queryable, limit: number): Promise<AuditLogEntry[]> {
  const { rows } = await db.query(
    `SELECT id, action, entity_type, entity_id, created_at
     FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
