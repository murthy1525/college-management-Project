import { pool } from "../../config/db";
import * as dashboardRepository from "./dashboard.repository";
import * as attendanceRepository from "../attendance/attendance.repository";

export async function getSummary() {
  const [students, departments, courses, staff, attendanceToday, recentActivity] = await Promise.all([
    dashboardRepository.studentCounts(pool),
    dashboardRepository.departmentCounts(pool),
    dashboardRepository.courseCounts(pool),
    dashboardRepository.staffCounts(pool),
    attendanceRepository.todaySnapshot(pool),
    dashboardRepository.recentActivity(pool, 10),
  ]);

  return { students, departments, courses, staff, attendanceToday, recentActivity };
}

const VALID_RANGES = ["day", "week", "month", "year"] as const;
type Range = (typeof VALID_RANGES)[number];

export async function getAnalytics(range: Range) {
  const [registrations, attendanceTrend, studentsByDepartment] = await Promise.all([
    dashboardRepository.registrationsTrend(pool, range),
    attendanceRepository.trend(pool, range),
    dashboardRepository.studentsByDepartment(pool),
  ]);

  return { registrations, attendanceTrend, studentsByDepartment };
}
