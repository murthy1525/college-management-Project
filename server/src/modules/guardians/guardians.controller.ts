import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as guardiansService from "./guardians.service";
import { createGuardianSchema } from "./guardians.validators";

export async function list(req: Request, res: Response) {
  const data = await guardiansService.listGuardians(req.params.studentId);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const parsed = createGuardianSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid guardian payload", parsed.error.flatten());
  }
  const data = await guardiansService.createGuardian(req.user!.userId, req.params.studentId, parsed.data);
  res.status(201).json({ success: true, data });
}
