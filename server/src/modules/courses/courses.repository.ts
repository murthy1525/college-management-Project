import { Queryable } from "../../config/db";
import { nextPublicId } from "../../utils/idGenerator";
import { Course } from "./courses.types";

const SELECT_COLUMNS =
  "c.id, c.public_id, c.name, c.duration_years, c.is_active, c.department_id, d.name AS department_name";

export interface CourseFilters {
  includeInactive: boolean;
  departmentId?: string;
}

export async function findAll(db: Queryable, filters: CourseFilters): Promise<Course[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!filters.includeInactive) conditions.push("c.is_active = true");
  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM courses c
     JOIN departments d ON d.id = c.department_id
     ${where}
     ORDER BY c.name ASC`,
    params
  );
  return rows;
}

export async function findById(db: Queryable, id: string | number): Promise<Course | null> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM courses c JOIN departments d ON d.id = c.department_id WHERE c.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findActiveCourseById(
  db: Queryable,
  courseId: number
): Promise<{ id: number; department_id: number } | null> {
  const { rows } = await db.query(
    "SELECT id, department_id FROM courses WHERE id = $1 AND is_active = true",
    [courseId]
  );
  return rows[0] ?? null;
}

export async function findActiveDepartmentById(
  db: Queryable,
  departmentId: number
): Promise<{ id: number } | null> {
  const { rows } = await db.query("SELECT id FROM departments WHERE id = $1 AND is_active = true", [
    departmentId,
  ]);
  return rows[0] ?? null;
}

export async function insert(
  db: import("pg").PoolClient,
  data: { name: string; departmentId: number; durationYears: number }
): Promise<Course> {
  const publicId = await nextPublicId(db, "course", "CRS");
  const { rows } = await db.query(
    `INSERT INTO courses (public_id, department_id, name, duration_years)
     VALUES ($1, $2, $3, $4)
     RETURNING id, public_id, name, duration_years, is_active, department_id`,
    [publicId, data.departmentId, data.name, data.durationYears]
  );
  return rows[0];
}

export async function updateStatus(
  db: Queryable,
  id: string | number,
  isActive: boolean
): Promise<Course | null> {
  const { rows } = await db.query(
    `UPDATE courses SET is_active = $1 WHERE id = $2
     RETURNING id, public_id, name, duration_years, is_active, department_id`,
    [isActive, id]
  );
  return rows[0] ?? null;
}
