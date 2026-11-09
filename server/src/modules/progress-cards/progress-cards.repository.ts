import { Queryable } from "../../config/db";
import { ProgressCard } from "./progress-cards.types";

const SELECT_COLUMNS = `
  pc.id, pc.student_id, pc.term, pc.remarks, pc.status,
  pc.created_by, pc.teacher_signed_by, pc.teacher_signed_at,
  pc.parent_signed_by, pc.parent_signed_at, pc.created_at, pc.updated_at,
  teacher.email AS teacher_signed_by_email,
  parent.email AS parent_signed_by_email
`;

const BASE_QUERY = `
  FROM progress_cards pc
  LEFT JOIN users teacher ON teacher.id = pc.teacher_signed_by
  LEFT JOIN users parent ON parent.id = pc.parent_signed_by
`;

export async function findByStudent(db: Queryable, studentId: string | number): Promise<ProgressCard[]> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_QUERY} WHERE pc.student_id = $1 ORDER BY pc.created_at DESC`,
    [studentId]
  );
  return rows;
}

export async function findOne(db: Queryable, studentId: string, cardId: string): Promise<ProgressCard | null> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} ${BASE_QUERY} WHERE pc.id = $1 AND pc.student_id = $2`,
    [cardId, studentId]
  );
  return rows[0] ?? null;
}

export async function insert(
  db: Queryable,
  data: { studentId: string; term: string; remarks?: string; createdBy: number }
): Promise<ProgressCard> {
  const { rows } = await db.query(
    `INSERT INTO progress_cards (student_id, term, remarks, created_by)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [data.studentId, data.term, data.remarks ?? null, data.createdBy]
  );
  const created = await findOne(db, data.studentId, String(rows[0].id));
  return created!;
}

function nextStatus(teacherSigned: boolean, parentSigned: boolean): ProgressCard["status"] {
  return teacherSigned && parentSigned ? "fully_signed" : "awaiting_signatures";
}

export async function signAsTeacher(db: Queryable, cardId: string, userId: number): Promise<ProgressCard | null> {
  const { rows } = await db.query("SELECT parent_signed_at FROM progress_cards WHERE id = $1", [cardId]);
  if (rows.length === 0) return null;
  const status = nextStatus(true, rows[0].parent_signed_at !== null);

  await db.query(
    `UPDATE progress_cards
     SET teacher_signed_by = $1, teacher_signed_at = now(), status = $2, updated_at = now()
     WHERE id = $3`,
    [userId, status, cardId]
  );
  const { rows: all } = await db.query(`SELECT ${SELECT_COLUMNS} ${BASE_QUERY} WHERE pc.id = $1`, [cardId]);
  return all[0] ?? null;
}

export async function signAsParent(db: Queryable, cardId: string, userId: number): Promise<ProgressCard | null> {
  const { rows } = await db.query("SELECT teacher_signed_at FROM progress_cards WHERE id = $1", [cardId]);
  if (rows.length === 0) return null;
  const status = nextStatus(rows[0].teacher_signed_at !== null, true);

  await db.query(
    `UPDATE progress_cards
     SET parent_signed_by = $1, parent_signed_at = now(), status = $2, updated_at = now()
     WHERE id = $3`,
    [userId, status, cardId]
  );
  const { rows: all } = await db.query(`SELECT ${SELECT_COLUMNS} ${BASE_QUERY} WHERE pc.id = $1`, [cardId]);
  return all[0] ?? null;
}
