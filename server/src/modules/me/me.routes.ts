import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as meController from "./me.controller";

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/students", asyncHandler(meController.myStudents));
