import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import * as coursesRepository from "./courses.repository";
import { Course } from "./courses.types";
import { CreateCourseInput } from "./courses.validators";

export async function listCourses(includeInactive: boolean, departmentId?: string): Promise<Course[]> {
  return coursesRepository.findAll(pool, { includeInactive, departmentId });
}

export async function createCourse(userId: number, input: CreateCourseInput): Promise<Course> {
  const department = await coursesRepository.findActiveDepartmentById(pool, input.departmentId);
  if (!department) {
    throw new ApiError(422, "INVALID_DEPARTMENT", "Department does not exist or is inactive");
  }

  return withTransaction(async (client) => {
    const course = await coursesRepository.insert(client, input);
    await recordAudit(client, {
      userId,
      action: "CREATE",
      entityType: "course",
      entityId: course.public_id,
      after: course,
    });
    return course;
  });
}

export async function setCourseStatus(userId: number, id: string, isActive: boolean): Promise<Course> {
  const before = await coursesRepository.findById(pool, id);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Course not found");

  const after = await coursesRepository.updateStatus(pool, id, isActive);
  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "course",
    entityId: before.public_id,
    before,
    after,
  });
  return after!;
}
