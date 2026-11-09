import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as coursesService from "./courses.service";
import { createCourseSchema, statusSchema } from "./courses.validators";

export async function list(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === "true";
  const departmentId = req.query.departmentId as string | undefined;
  const data = await coursesService.listCourses(includeInactive, departmentId);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const parsed = createCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid course payload", parsed.error.flatten());
  }
  const data = await coursesService.createCourse(req.user!.userId, parsed.data);
  res.status(201).json({ success: true, data });
}

export async function setStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required", parsed.error.flatten());
  }
  const data = await coursesService.setCourseStatus(req.user!.userId, req.params.id, parsed.data.isActive);
  res.json({ success: true, data });
}
