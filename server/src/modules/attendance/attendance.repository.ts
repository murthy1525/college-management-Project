import { Queryable } from "../../config/db";
import { AttendanceRecord, AttendanceStatus, AttendanceSummary, RosterEntry, TrendPoint } from "./attendance.types";

export interface RosterFilters {
  departmentId?: string;
  courseId?: string;
}

export async function findRoster(db: Queryable, date: string, filters: RosterFilters): Promise<RosterEntry[]> {
  const conditions: string[] = ["s.is_active = true"];
  const params: unknown[] = [date];

  if (filters.departmentId) {
    params.push(filters.departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }
  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`s.course_id = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT s.id AS student_id, s.public_id, s.first_name, s.last_name,
            d.name AS department_name, c.name AS course_name, sa.status
     FROM students s
     JOIN departments d ON d.id = s.department_id
     JOIN courses c ON c.id = s.course_id
     LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.attendance_date = $1
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.first_name, s.last_name`,
    params
  );
  return rows;
}

export async function upsertMany(
  db: Queryable,
  date: string,
  records: { studentId: number; status: AttendanceStatus }[],
  markedBy: number
): Promise<void> {
  if (records.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  records.forEach((r, i) => {
    const base = i * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(r.studentId, date, r.status, markedBy);
  });

  await db.query(
    `INSERT INTO student_attendance (student_id, attendance_date, status, marked_by)
     VALUES ${values.join(",")}
     ON CONFLICT (student_id, attendance_date)
     DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
    params
  );
}

export async function findByStudent(
  db: Queryable,
  studentId: string,
  from: string,
  to: string
): Promise<AttendanceRecord[]> {
  const { rows } = await db.query(
    `SELECT id, attendance_date, status, marked_at
     FROM student_attendance
     WHERE student_id = $1 AND attendance_date BETWEEN $2 AND $3
     ORDER BY attendance_date DESC`,
    [studentId, from, to]
  );
  return rows;
}

export async function summaryForStudent(db: Queryable, studentId: string): Promise<AttendanceSummary> {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'present')::int AS present,
       COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
       COUNT(*) FILTER (WHERE status = 'late')::int AS late,
       COUNT(*) FILTER (WHERE status = 'leave')::int AS leave
     FROM student_attendance WHERE student_id = $1`,
    [studentId]
  );
  const { present, absent, late, leave } = rows[0];
  // Approved leave is excluded from both numerator and denominator, not
  // folded into "absent" — see docs/ROADMAP.md's documented default.
  const eligible = present + absent + late;
  return {
    present,
    absent,
    late,
    leave,
    percentage: eligible === 0 ? null : Math.round((present / eligible) * 1000) / 10,
  };
}

const RANGE_CONFIG: Record<string, { unit: string; count: number }> = {
  day: { unit: "day", count: 14 },
  week: { unit: "week", count: 12 },
  month: { unit: "month", count: 12 },
  year: { unit: "year", count: 5 },
};

/** `range` is validated against a fixed enum before this is ever called, so
 * interpolating it into the interval literal below is safe — it is never
 * raw user text reaching SQL. */
export async function trend(db: Queryable, range: keyof typeof RANGE_CONFIG): Promise<TrendPoint[]> {
  const { unit, count } = RANGE_CONFIG[range];

  const { rows } = await db.query(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('${unit}', now()) - (${count - 1} * interval '1 ${unit}'),
         date_trunc('${unit}', now()),
         interval '1 ${unit}'
       ) AS bucket
     )
     SELECT
       b.bucket,
       COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int AS present,
       COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int AS absent,
       COUNT(sa.id) FILTER (WHERE sa.status = 'late')::int AS late,
       COUNT(sa.id) FILTER (WHERE sa.status = 'leave')::int AS leave,
       COUNT(sa.id)::int AS marked
     FROM buckets b
     LEFT JOIN student_attendance sa ON date_trunc('${unit}', sa.attendance_date) = b.bucket
     GROUP BY b.bucket
     ORDER BY b.bucket`
  );

  return rows.map((r) => {
    const eligible = r.present + r.absent + r.late;
    return {
      bucket: r.bucket,
      present: r.present,
      absent: r.absent,
      late: r.late,
      leave: r.leave,
      marked: r.marked,
      percentage: eligible === 0 ? null : Math.round((r.present / eligible) * 1000) / 10,
    };
  });
}

export async function todaySnapshot(db: Queryable): Promise<{ marked: number; present: number; totalActive: number }> {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM students WHERE is_active = true) AS total_active,
       COUNT(*)::int AS marked,
       COUNT(*) FILTER (WHERE status = 'present')::int AS present
     FROM student_attendance
     WHERE attendance_date = CURRENT_DATE`
  );
  return { marked: rows[0].marked, present: rows[0].present, totalActive: rows[0].total_active };
}
