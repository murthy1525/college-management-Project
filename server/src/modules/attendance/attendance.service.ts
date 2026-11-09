import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import { AccessTokenPayload } from "../../utils/jwt";
import { assertCanAccessStudent } from "../students/students.access";
import * as attendanceRepository from "./attendance.repository";
import { RosterFilters } from "./attendance.repository";
import { MarkAttendanceInput } from "./attendance.validators";

export async function getRoster(date: string, filters: RosterFilters) {
  return attendanceRepository.findRoster(pool, date, filters);
}

export async function markAttendance(userId: number, input: MarkAttendanceInput): Promise<void> {
  await attendanceRepository.upsertMany(
    pool,
    input.date,
    input.records.map((r) => ({ studentId: r.studentId, status: r.status })),
    userId
  );

  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "attendance_batch",
    entityId: input.date,
    after: { date: input.date, count: input.records.length },
  });
}

export async function getStudentAttendance(caller: AccessTokenPayload, studentId: string, from?: string, to?: string) {
  await assertCanAccessStudent(caller, Number(studentId));

  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const fromDate = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [records, summary] = await Promise.all([
    attendanceRepository.findByStudent(pool, studentId, fromDate, toDate),
    attendanceRepository.summaryForStudent(pool, studentId),
  ]);

  return { records, summary };
}

const VALID_RANGES = ["day", "week", "month", "year"] as const;
type Range = (typeof VALID_RANGES)[number];

export async function getTrend(range: Range) {
  if (!VALID_RANGES.includes(range)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid range");
  return attendanceRepository.trend(pool, range);
}

export async function getTodaySnapshot() {
  return attendanceRepository.todaySnapshot(pool);
}
