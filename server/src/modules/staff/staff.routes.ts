import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as staffController from "./staff.controller";

export const staffRouter = Router();
staffRouter.use(requireAuth, requireRole("admin"));

staffRouter.get("/", asyncHandler(staffController.list));
staffRouter.post("/", asyncHandler(staffController.create));
staffRouter.patch("/:userId/status", asyncHandler(staffController.setStatus));
