import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();
// Aggregate counts are not a given student's personal data, but they still
// reveal org-wide numbers that belong to staff, not every logged-in parent
// or student — gate at the role level like everything else, not just by
// which pages the frontend happens to call this from.
dashboardRouter.use(requireAuth, requireRole("admin", "hod", "lecturer", "principal"));

dashboardRouter.get("/summary", asyncHandler(dashboardController.summary));
dashboardRouter.get("/analytics", asyncHandler(dashboardController.analytics));
