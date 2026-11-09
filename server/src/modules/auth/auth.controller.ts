import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as authService from "./auth.service";
import { loginSchema } from "./auth.validators";

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid credentials payload", parsed.error.flatten());
  }
  const data = await authService.login(parsed.data);
  res.json({ success: true, data });
}

export function me(req: Request, res: Response) {
  res.json({ success: true, data: req.user });
}
