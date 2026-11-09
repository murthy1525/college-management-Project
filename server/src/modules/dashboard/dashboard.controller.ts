import { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";

export async function summary(_req: Request, res: Response) {
  const data = await dashboardService.getSummary();
  res.json({ success: true, data });
}
