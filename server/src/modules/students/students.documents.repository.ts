import { Queryable } from "../../config/db";
import { StudentDocument } from "./students.types";

const SELECT_COLUMNS =
  "id, doc_type, original_name, mime_type, size_bytes, verified_status, is_active, uploaded_at";

export async function findByStudent(db: Queryable, studentId: string | number): Promise<StudentDocument[]> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM student_documents WHERE student_id = $1 ORDER BY uploaded_at DESC`,
    [studentId]
  );
  return rows;
}

export interface StudentDocumentRecord extends StudentDocument {
  student_id: number;
  stored_path: string;
}

export async function findOne(
  db: Queryable,
  studentId: string,
  docId: string
): Promise<StudentDocumentRecord | null> {
  const { rows } = await db.query(
    "SELECT * FROM student_documents WHERE id = $1 AND student_id = $2",
    [docId, studentId]
  );
  return rows[0] ?? null;
}

export async function insert(
  db: Queryable,
  data: {
    studentId: string;
    docType: string;
    originalName: string;
    storedPath: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: number;
  }
): Promise<StudentDocument> {
  const { rows } = await db.query(
    `INSERT INTO student_documents
       (student_id, doc_type, original_name, stored_path, mime_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${SELECT_COLUMNS}`,
    [data.studentId, data.docType, data.originalName, data.storedPath, data.mimeType, data.sizeBytes, data.uploadedBy]
  );
  return rows[0];
}

export async function updateStatus(
  db: Queryable,
  docId: string,
  isActive: boolean
): Promise<StudentDocument | null> {
  const { rows } = await db.query(
    `UPDATE student_documents SET is_active = $1 WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
    [isActive, docId]
  );
  return rows[0] ?? null;
}
