import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as attendanceController from "./attendance.controller";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth, requireRole("admin", "hod", "lecturer"));

attendanceRouter.get("/roster", asyncHandler(attendanceController.roster));
attendanceRouter.post("/mark", asyncHandler(attendanceController.mark));
attendanceRouter.get("/trend", asyncHandler(attendanceController.trend));
attendanceRouter.get("/today", asyncHandler(attendanceController.todaySnapshot));
