import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as staffService from "./staff.service";
import { createStaffSchema, staffStatusSchema } from "./staff.validators";

export async function list(_req: Request, res: Response) {
  const data = await staffService.listStaff();
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid staff payload", parsed.error.flatten());
  }
  const data = await staffService.createStaff(req.user!.userId, parsed.data);
  res.status(201).json({ success: true, data });
}

export async function setStatus(req: Request, res: Response) {
  const parsed = staffStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid status payload", parsed.error.flatten());
  }
  const data = await staffService.setStaffStatus(req.user!.userId, req.params.userId, parsed.data.status);
  res.json({ success: true, data });
}
