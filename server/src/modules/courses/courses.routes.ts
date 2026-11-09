import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as coursesController from "./courses.controller";

export const coursesRouter = Router();

coursesRouter.use(requireAuth);

coursesRouter.get("/", asyncHandler(coursesController.list));
coursesRouter.post("/", requireRole("admin"), asyncHandler(coursesController.create));
coursesRouter.patch("/:id/status", requireRole("admin"), asyncHandler(coursesController.setStatus));
