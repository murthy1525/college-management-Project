import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { AccessTokenPayload } from "../../utils/jwt";

const STAFF_ROLES = ["admin", "hod", "principal", "lecturer"];

export function isStaff(user: AccessTokenPayload): boolean {
  return user.roles.some((r) => STAFF_ROLES.includes(r));
}

/**
 * Resolves which student ids the caller is allowed to see at all:
 *  - staff: unrestricted (null means "no filtering needed")
 *  - student: only their own linked row
 *  - parent: only the children linked to their guardian records
 * Used both to scope list queries and to gate a single-student lookup.
 */
export async function allowedStudentIds(user: AccessTokenPayload): Promise<number[] | null> {
  if (isStaff(user)) return null;

  if (user.roles.includes("student")) {
    const { rows } = await pool.query("SELECT id FROM students WHERE user_id = $1", [user.userId]);
    return rows.map((r) => r.id);
  }

  if (user.roles.includes("parent")) {
    const { rows } = await pool.query(
      "SELECT DISTINCT student_id FROM student_guardians WHERE user_id = $1",
      [user.userId]
    );
    return rows.map((r) => r.student_id);
  }

  return [];
}

export async function assertCanAccessStudent(user: AccessTokenPayload, studentId: number): Promise<void> {
  const allowed = await allowedStudentIds(user);
  if (allowed === null) return; // staff: unrestricted
  if (!allowed.includes(studentId)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this student's record");
  }
}
