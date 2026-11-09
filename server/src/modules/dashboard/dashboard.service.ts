import { pool } from "../../config/db";
import * as dashboardRepository from "./dashboard.repository";

export async function getSummary() {
  const [students, departments, courses, recentActivity] = await Promise.all([
    dashboardRepository.studentCounts(pool),
    dashboardRepository.departmentCounts(pool),
    dashboardRepository.courseCounts(pool),
    dashboardRepository.recentActivity(pool, 10),
  ]);

  return { students, departments, courses, recentActivity };
}
