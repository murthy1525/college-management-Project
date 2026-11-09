import { PoolClient } from "pg";
import { Queryable } from "../../config/db";
import { nextPublicId } from "../../utils/idGenerator";
import { CreateStudentInput, UpdateStudentInput } from "./students.validators";
import { Student, StudentListFilters, StudentListItem } from "./students.types";

export interface PagedResult<T> {
  rows: T[];
  total: number;
}

export async function findAll(
  db: Queryable,
  filters: StudentListFilters,
  restrictToIds: number[] | null
): Promise<PagedResult<StudentListItem>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (restrictToIds !== null) {
    // Empty array must still exclude everything, not be ignored as "no filter".
    params.push(restrictToIds);
    conditions.push(`s.id = ANY($${params.length}::int[])`);
  }
  if (!filters.includeInactive) conditions.push("s.is_active = true");
  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }
  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`s.course_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(
      `(LOWER(s.first_name || ' ' || s.last_name) LIKE $${idx}
        OR LOWER(s.public_id) LIKE $${idx}
        OR LOWER(s.admission_number) LIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: countRows } = await db.query(`SELECT COUNT(*)::int AS total FROM students s ${where}`, params);

  const offset = (filters.page - 1) * filters.pageSize;
  const listParams = [...params, filters.pageSize, offset];
  const { rows } = await db.query(
    `SELECT s.id, s.public_id, s.admission_number, s.first_name, s.last_name,
            s.photo_url, s.status, s.is_active, s.current_year_of_study,
            d.name AS department_name, c.name AS course_name
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses c ON c.id = s.course_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return { rows, total: countRows[0].total };
}

export async function findByIdOrPublicId(db: Queryable, idOrPublicId: string): Promise<(Student & {
  department_name: string;
  course_name: string;
}) | null> {
  const { rows } = await db.query(
    `SELECT s.*, d.name AS department_name, c.name AS course_name
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses c ON c.id = s.course_id
     WHERE s.id::text = $1 OR s.public_id = $1`,
    [idOrPublicId]
  );
  return rows[0] ?? null;
}

export async function findBasicByIds(db: Queryable, ids: number[]): Promise<StudentListItem[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    `SELECT s.id, s.public_id, s.admission_number, s.first_name, s.last_name,
            s.photo_url, s.status, s.is_active, s.current_year_of_study,
            d.name AS department_name, c.name AS course_name
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses c ON c.id = s.course_id
     WHERE s.id = ANY($1::int[])
     ORDER BY s.first_name, s.last_name`,
    [ids]
  );
  return rows;
}

export async function findByUserId(db: Queryable, userId: number): Promise<{ id: number; public_id: string } | null> {
  const { rows } = await db.query("SELECT id, public_id FROM students WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

export async function findByAdmissionNumber(db: Queryable, admissionNumber: string): Promise<{ id: number } | null> {
  const { rows } = await db.query("SELECT id FROM students WHERE admission_number = $1", [admissionNumber]);
  return rows[0] ?? null;
}

export async function insert(
  db: PoolClient,
  input: CreateStudentInput,
  createdBy: number
): Promise<Student> {
  const publicId = await nextPublicId(db, "student", "STU");
  const { rows } = await db.query(
    `INSERT INTO students
       (public_id, admission_number, first_name, middle_name, last_name, dob, gender,
        blood_group, mobile, email, permanent_address, current_address, nationality,
        department_id, course_id, current_year_of_study, previous_institution,
        previous_qualification, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)
     RETURNING *`,
    [
      publicId, input.admissionNumber, input.firstName, input.middleName ?? null, input.lastName, input.dob,
      input.gender, input.bloodGroup ?? null, input.mobile, input.email ?? null, input.permanentAddress ?? null,
      input.currentAddress ?? null, input.nationality ?? null, input.departmentId, input.courseId,
      input.currentYearOfStudy, input.previousInstitution ?? null, input.previousQualification ?? null, createdBy,
    ]
  );
  return rows[0];
}

const UPDATABLE_COLUMNS: Record<keyof UpdateStudentInput, string> = {
  firstName: "first_name",
  middleName: "middle_name",
  lastName: "last_name",
  dob: "dob",
  gender: "gender",
  bloodGroup: "blood_group",
  mobile: "mobile",
  email: "email",
  permanentAddress: "permanent_address",
  currentAddress: "current_address",
  nationality: "nationality",
  departmentId: "department_id",
  courseId: "course_id",
  currentYearOfStudy: "current_year_of_study",
  previousInstitution: "previous_institution",
  previousQualification: "previous_qualification",
};

export async function updateFields(
  db: Queryable,
  id: string,
  input: UpdateStudentInput,
  updatedBy: number
): Promise<Student | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS) as [keyof UpdateStudentInput, string][]) {
    const value = input[key];
    if (value === undefined) continue;
    params.push(value);
    setClauses.push(`${column} = $${params.length}`);
  }

  if (setClauses.length === 0) return findByIdOrPublicId(db, id);

  params.push(updatedBy);
  setClauses.push(`updated_by = $${params.length}`, "updated_at = now()");
  params.push(id);

  const { rows } = await db.query(
    `UPDATE students SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

export async function findRawById(db: Queryable, id: string): Promise<Student | null> {
  const { rows } = await db.query("SELECT * FROM students WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function updateStatus(db: Queryable, id: string, isActive: boolean, updatedBy: number): Promise<Student | null> {
  const { rows } = await db.query(
    "UPDATE students SET is_active = $1, updated_at = now(), updated_by = $2 WHERE id = $3 RETURNING *",
    [isActive, updatedBy, id]
  );
  return rows[0] ?? null;
}
