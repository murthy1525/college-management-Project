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

export async function staffCounts(db: Queryable): Promise<StatusCounts & { byRole: { role: string; count: number }[] }> {
  const { rows } = await db.query(
    `SELECT r.code AS role, COUNT(DISTINCT u.id)::int AS count
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.code IN ('admin','hod','lecturer','principal')
     GROUP BY r.code
     ORDER BY r.code`
  );
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const { rows: activeRows } = await db.query(
    `SELECT COUNT(DISTINCT u.id)::int AS active
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.code IN ('admin','hod','lecturer','principal') AND u.status = 'active'`
  );
  return { total, active: activeRows[0].active, byRole: rows };
}

export interface DepartmentBreakdownEntry {
  department: string;
  count: number;
}

export async function studentsByDepartment(db: Queryable): Promise<DepartmentBreakdownEntry[]> {
  const { rows } = await db.query(
    `SELECT d.name AS department, COUNT(s.id)::int AS count
     FROM departments d
     LEFT JOIN students s ON s.department_id = d.id AND s.is_active = true
     WHERE d.is_active = true
     GROUP BY d.name
     ORDER BY count DESC`
  );
  return rows;
}

export interface RegistrationTrendPoint {
  bucket: string;
  count: number;
}

const RANGE_CONFIG: Record<string, { unit: string; count: number }> = {
  day: { unit: "day", count: 14 },
  week: { unit: "week", count: 12 },
  month: { unit: "month", count: 12 },
  year: { unit: "year", count: 5 },
};

/** `range` is validated against a fixed enum before this is called. */
export async function registrationsTrend(db: Queryable, range: keyof typeof RANGE_CONFIG): Promise<RegistrationTrendPoint[]> {
  const { unit, count } = RANGE_CONFIG[range];
  const { rows } = await db.query(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('${unit}', now()) - (${count - 1} * interval '1 ${unit}'),
         date_trunc('${unit}', now()),
         interval '1 ${unit}'
       ) AS bucket
     )
     SELECT b.bucket, COUNT(s.id)::int AS count
     FROM buckets b
     LEFT JOIN students s ON date_trunc('${unit}', s.created_at) = b.bucket
     GROUP BY b.bucket
     ORDER BY b.bucket`
  );
  return rows;
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
