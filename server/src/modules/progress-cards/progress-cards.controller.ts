import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as progressCardsService from "./progress-cards.service";
import { createProgressCardSchema } from "./progress-cards.validators";

export async function list(req: Request, res: Response) {
  const data = await progressCardsService.listProgressCards(req.user!, req.params.studentId);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const parsed = createProgressCardSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid progress card payload", parsed.error.flatten());
  }
  const data = await progressCardsService.createProgressCard(req.user!.userId, req.params.studentId, parsed.data);
  res.status(201).json({ success: true, data });
}

export async function signTeacher(req: Request, res: Response) {
  const data = await progressCardsService.signAsTeacher(req.user!.userId, req.params.studentId, req.params.cardId);
  res.json({ success: true, data });
}

export async function signParent(req: Request, res: Response) {
  const data = await progressCardsService.signAsParent(req.user!, req.params.studentId, req.params.cardId);
  res.json({ success: true, data });
}
