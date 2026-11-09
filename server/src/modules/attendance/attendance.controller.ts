import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as attendanceService from "./attendance.service";
import { markAttendanceSchema, rangeSchema } from "./attendance.validators";

export async function roster(req: Request, res: Response) {
  const date = req.query.date as string | undefined;
  if (!date) throw new ApiError(400, "VALIDATION_ERROR", "date query param is required");

  const data = await attendanceService.getRoster(date, {
    departmentId: req.query.departmentId as string | undefined,
    courseId: req.query.courseId as string | undefined,
  });
  res.json({ success: true, data });
}

export async function mark(req: Request, res: Response) {
  const parsed = markAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid attendance payload", parsed.error.flatten());
  }
  await attendanceService.markAttendance(req.user!.userId, parsed.data);
  res.status(201).json({ success: true, data: { marked: parsed.data.records.length } });
}

export async function trend(req: Request, res: Response) {
  const parsed = rangeSchema.safeParse(req.query.range);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "range must be one of day, week, month, year");
  }
  const data = await attendanceService.getTrend(parsed.data);
  res.json({ success: true, data });
}

export async function todaySnapshot(_req: Request, res: Response) {
  const data = await attendanceService.getTodaySnapshot();
  res.json({ success: true, data });
}
