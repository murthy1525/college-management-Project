import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as dashboardService from "./dashboard.service";

const VALID_RANGES = ["day", "week", "month", "year"];

export async function summary(_req: Request, res: Response) {
  const data = await dashboardService.getSummary();
  res.json({ success: true, data });
}

export async function analytics(req: Request, res: Response) {
  const range = (req.query.range as string) ?? "month";
  if (!VALID_RANGES.includes(range)) {
    throw new ApiError(400, "VALIDATION_ERROR", "range must be one of day, week, month, year");
  }
  const data = await dashboardService.getAnalytics(range as "day" | "week" | "month" | "year");
  res.json({ success: true, data });
}
