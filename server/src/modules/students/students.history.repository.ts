import { PoolClient } from "pg";
import { Queryable } from "../../config/db";

export interface AcademicHistoryEntry {
  id: number;
  event_type: string;
  year_of_study: number;
  effective_date: string;
  department_name: string;
  course_name: string;
}

export async function recordEvent(
  db: PoolClient,
  params: {
    studentId: number;
    departmentId: number;
    courseId: number;
    yearOfStudy: number;
    eventType: "enrolled" | "promoted" | "transferred" | "repeated" | "graduated" | "withdrawn";
    recordedBy: number;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO student_academic_history
       (student_id, department_id, course_id, year_of_study, event_type, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [params.studentId, params.departmentId, params.courseId, params.yearOfStudy, params.eventType, params.recordedBy]
  );
}

export async function findByStudent(db: Queryable, studentId: number): Promise<AcademicHistoryEntry[]> {
  const { rows } = await db.query(
    `SELECT h.id, h.event_type, h.year_of_study, h.effective_date,
            d.name AS department_name, c.name AS course_name
     FROM student_academic_history h
     JOIN departments d ON d.id = h.department_id
     JOIN courses c ON c.id = h.course_id
     WHERE h.student_id = $1
     ORDER BY h.effective_date DESC, h.id DESC`,
    [studentId]
  );
  return rows;
}
