import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as departmentsService from "./departments.service";
import { createDepartmentSchema, statusSchema, updateDepartmentSchema } from "./departments.validators";

export async function list(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === "true";
  const data = await departmentsService.listDepartments(includeInactive);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const parsed = createDepartmentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid department payload", parsed.error.flatten());
  }
  const data = await departmentsService.createDepartment(req.user!.userId, parsed.data);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const parsed = updateDepartmentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid department payload", parsed.error.flatten());
  }
  const data = await departmentsService.updateDepartment(req.user!.userId, req.params.id, parsed.data);
  res.json({ success: true, data });
}

export async function setStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required", parsed.error.flatten());
  }
  const data = await departmentsService.setDepartmentStatus(req.user!.userId, req.params.id, parsed.data.isActive);
  res.json({ success: true, data });
}
