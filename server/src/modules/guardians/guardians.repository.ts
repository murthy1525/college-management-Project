import { PoolClient } from "pg";
import { Queryable } from "../../config/db";
import { Guardian } from "./guardians.types";

const SELECT_COLUMNS =
  "id, student_id, relationship, name, contact_number, email, user_id, (user_id IS NOT NULL) AS has_login";

export async function findByStudent(db: Queryable, studentId: number | string): Promise<Guardian[]> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM student_guardians WHERE student_id = $1 ORDER BY id ASC`,
    [studentId]
  );
  return rows;
}

export async function findOne(db: Queryable, studentId: string, guardianId: string): Promise<Guardian | null> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM student_guardians WHERE id = $1 AND student_id = $2`,
    [guardianId, studentId]
  );
  return rows[0] ?? null;
}

export async function insert(
  db: PoolClient,
  data: {
    studentId: string;
    relationship: string;
    name: string;
    contactNumber?: string;
    email?: string;
    userId?: number;
  }
): Promise<Guardian> {
  const { rows } = await db.query(
    `INSERT INTO student_guardians (student_id, relationship, name, contact_number, email, user_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${SELECT_COLUMNS}`,
    [data.studentId, data.relationship, data.name, data.contactNumber ?? null, data.email ?? null, data.userId ?? null]
  );
  return rows[0];
}

/** Which student ids a parent's login is linked to — drives their whole "My Children" view. */
export async function findChildStudentIdsByUserId(db: Queryable, userId: number): Promise<number[]> {
  const { rows } = await db.query(
    "SELECT DISTINCT student_id FROM student_guardians WHERE user_id = $1",
    [userId]
  );
  return rows.map((r) => r.student_id);
}
