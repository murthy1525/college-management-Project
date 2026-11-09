import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as departmentsController from "./departments.controller";

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get("/", asyncHandler(departmentsController.list));
departmentsRouter.post("/", requireRole("admin"), asyncHandler(departmentsController.create));
departmentsRouter.put("/:id", requireRole("admin"), asyncHandler(departmentsController.update));
departmentsRouter.patch("/:id/status", requireRole("admin"), asyncHandler(departmentsController.setStatus));
