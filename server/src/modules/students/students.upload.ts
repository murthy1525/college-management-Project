import fs from "fs";
import path from "path";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../middleware/error.middleware";

export const UPLOAD_ROOT = path.join(process.cwd(), env.uploadDir, "students");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// studentId comes from the route param of an already-authenticated request;
// still guard it before using it as a directory name so a crafted value
// can never be used to write outside UPLOAD_ROOT.
export function safeStudentDir(studentId: string): string {
  if (!/^\d+$/.test(studentId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid student id");
  }
  return path.join(UPLOAD_ROOT, studentId);
}

export function resolveDocumentPath(storedPath: string): string {
  const absolutePath = path.resolve(process.cwd(), storedPath);
  if (!absolutePath.startsWith(UPLOAD_ROOT)) {
    throw new ApiError(404, "FILE_MISSING", "File no longer exists on disk");
  }
  return absolutePath;
}

// Buffered in memory (documents are capped at MAX_UPLOAD_MB, small by design)
// so the service layer can verify the real file type from its magic bytes
// before anything touches disk — the client-supplied Content-Type header and
// original filename extension are both spoofable and must not be trusted
// for either the MIME type or the stored file's extension.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
});

/** multer's own errors don't flow through Express's normal next(err) chain
 * unless funneled explicitly here. */
export function uploadSingle(fieldName: string) {
  const middleware = upload.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, "UPLOAD_ERROR", err.message));
      }
      next(err);
    });
  };
}
