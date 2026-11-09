import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { uploadSingle } from "./students.upload";
import * as studentsController from "./students.controller";
import * as guardiansController from "../guardians/guardians.controller";
import * as progressCardsController from "../progress-cards/progress-cards.controller";

export const studentsRouter = Router();
studentsRouter.use(requireAuth);

studentsRouter.get("/", asyncHandler(studentsController.list));
studentsRouter.post("/", requireRole("admin", "hod"), asyncHandler(studentsController.create));

studentsRouter.get("/:studentId", asyncHandler(studentsController.getOne));
studentsRouter.put("/:studentId", requireRole("admin", "hod"), asyncHandler(studentsController.update));
studentsRouter.patch("/:studentId/status", requireRole("admin", "hod"), asyncHandler(studentsController.setStatus));
studentsRouter.post("/:studentId/login", requireRole("admin", "hod"), asyncHandler(studentsController.createLogin));

studentsRouter.get("/:studentId/documents", asyncHandler(studentsController.listDocuments));
studentsRouter.post(
  "/:studentId/documents",
  requireRole("admin", "hod"),
  uploadSingle("file"),
  asyncHandler(studentsController.uploadDocument)
);
studentsRouter.get("/:studentId/documents/:docId/file", asyncHandler(studentsController.getDocumentFile));
studentsRouter.patch(
  "/:studentId/documents/:docId/status",
  requireRole("admin", "hod"),
  asyncHandler(studentsController.setDocumentStatus)
);

studentsRouter.get("/:studentId/guardians", requireRole("admin", "hod"), asyncHandler(guardiansController.list));
studentsRouter.post("/:studentId/guardians", requireRole("admin", "hod"), asyncHandler(guardiansController.create));

studentsRouter.get("/:studentId/progress-cards", asyncHandler(progressCardsController.list));
studentsRouter.post(
  "/:studentId/progress-cards",
  requireRole("admin", "hod", "lecturer"),
  asyncHandler(progressCardsController.create)
);
studentsRouter.patch(
  "/:studentId/progress-cards/:cardId/sign-teacher",
  requireRole("admin", "hod", "lecturer"),
  asyncHandler(progressCardsController.signTeacher)
);
studentsRouter.patch(
  "/:studentId/progress-cards/:cardId/sign-parent",
  requireRole("parent"),
  asyncHandler(progressCardsController.signParent)
);
