import { Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import * as studentsService from "./students.service";
import {
  createLoginSchema,
  createStudentSchema,
  documentStatusSchema,
  statusSchema,
  updateStudentSchema,
  uploadDocumentSchema,
} from "./students.validators";

export async function list(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));

  const { rows, total } = await studentsService.listStudents(req.user!, {
    page,
    pageSize,
    includeInactive: req.query.includeInactive === "true",
    departmentId: req.query.departmentId as string | undefined,
    courseId: req.query.courseId as string | undefined,
    search: (req.query.search as string | undefined)?.trim(),
  });

  res.json({ success: true, data: rows, meta: { page, pageSize, total } });
}

export async function create(req: Request, res: Response) {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid student payload", parsed.error.flatten());
  }
  const data = await studentsService.createStudent(req.user!.userId, parsed.data);
  res.status(201).json({ success: true, data });
}

export async function getOne(req: Request, res: Response) {
  const data = await studentsService.getStudentProfile(req.user!, req.params.studentId);
  res.json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const parsed = updateStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid student payload", parsed.error.flatten());
  }
  const data = await studentsService.updateStudent(req.user!.userId, req.params.studentId, parsed.data);
  res.json({ success: true, data });
}

export async function setStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required", parsed.error.flatten());
  }
  const data = await studentsService.setStudentStatus(
    req.user!.userId,
    req.params.studentId,
    parsed.data.isActive,
    parsed.data.reason
  );
  res.json({ success: true, data });
}

export async function listDocuments(req: Request, res: Response) {
  const data = await studentsService.listDocuments(req.user!, req.params.studentId);
  res.json({ success: true, data });
}

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) throw new ApiError(400, "FILE_REQUIRED", "No file uploaded");

  const parsed = uploadDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid document payload", parsed.error.flatten());
  }

  const data = await studentsService.uploadDocument(
    req.user!.userId,
    req.params.studentId,
    parsed.data.docType,
    req.file
  );
  res.status(201).json({ success: true, data });
}

export async function getDocumentFile(req: Request, res: Response) {
  const { absolutePath, mimeType, originalName } = await studentsService.getDocumentFile(
    req.user!,
    req.params.studentId,
    req.params.docId
  );

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(originalName)}"`);
  res.sendFile(absolutePath);
}

export async function createLogin(req: Request, res: Response) {
  const parsed = createLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "A password of at least 8 characters is required", parsed.error.flatten());
  }
  await studentsService.createStudentLogin(req.user!.userId, req.params.studentId, parsed.data.password);
  res.status(201).json({ success: true, data: { created: true } });
}

export async function setDocumentStatus(req: Request, res: Response) {
  const parsed = documentStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required", parsed.error.flatten());
  }
  const data = await studentsService.setDocumentStatus(
    req.user!.userId,
    req.params.studentId,
    req.params.docId,
    parsed.data.isActive
  );
  res.json({ success: true, data });
}
