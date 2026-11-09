import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { nextPublicId } from "../../utils/idGenerator";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";

export const studentsRouter = Router();
studentsRouter.use(requireAuth);

const UPLOAD_ROOT = path.join(process.cwd(), env.uploadDir, "students");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

// studentId comes from the already-authenticated, numeric-only route param;
// still guard against path traversal/odd input before using it as a directory name.
function safeStudentDir(studentId: string): string {
  if (!/^\d+$/.test(studentId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid student id");
  }
  return path.join(UPLOAD_ROOT, studentId);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const dir = safeStudentDir(req.params.studentId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new ApiError(400, "INVALID_FILE_TYPE", "Only JPG, PNG, or PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

function uploadSingle(fieldName: string) {
  const mw = upload.single(fieldName);
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, "UPLOAD_ERROR", err.message));
      }
      next(err);
    });
  };
}

// ---------- List (paginated, filterable, searchable) ----------
studentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;
    const includeInactive = req.query.includeInactive === "true";
    const departmentId = req.query.departmentId as string | undefined;
    const courseId = req.query.courseId as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!includeInactive) conditions.push("s.is_active = true");
    if (departmentId) {
      params.push(departmentId);
      conditions.push(`s.department_id = $${params.length}`);
    }
    if (courseId) {
      params.push(courseId);
      conditions.push(`s.course_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      const idx = params.length;
      conditions.push(
        `(LOWER(s.first_name || ' ' || s.last_name) LIKE $${idx}
          OR LOWER(s.public_id) LIKE $${idx}
          OR LOWER(s.admission_number) LIKE $${idx})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM students s ${where}`,
      params
    );

    const listParams = [...params, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT s.id, s.public_id, s.admission_number, s.first_name, s.last_name,
              s.photo_url, s.status, s.is_active, s.current_year_of_study,
              d.name AS department_name, c.name AS course_name
       FROM students s
       JOIN departments d ON d.id = s.department_id
       JOIN courses c ON c.id = s.course_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({
      success: true,
      data: rows,
      meta: { page, pageSize, total: countRows[0].total },
    });
  })
);

// ---------- Create ----------
const createSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1).max(80),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), {
    message: "dob must be a valid past date",
  }),
  gender: z.string().min(1).max(20),
  bloodGroup: z.string().max(10).optional(),
  mobile: z.string().min(6).max(20),
  email: z.string().email().optional(),
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  nationality: z.string().max(80).optional(),
  departmentId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  currentYearOfStudy: z.number().int().min(1).max(10).default(1),
  admissionNumber: z.string().min(1).max(40),
  previousInstitution: z.string().max(200).optional(),
  previousQualification: z.string().max(150).optional(),
});

studentsRouter.post(
  "/",
  requireRole("admin", "hod"),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid student payload", parsed.error.flatten());
    }
    const d = parsed.data;

    const { rows: course } = await pool.query(
      "SELECT id, department_id FROM courses WHERE id = $1 AND is_active = true",
      [d.courseId]
    );
    if (course.length === 0) throw new ApiError(422, "INVALID_COURSE", "Course does not exist or is inactive");
    if (course[0].department_id !== d.departmentId) {
      throw new ApiError(422, "COURSE_DEPARTMENT_MISMATCH", "Course does not belong to the selected department");
    }

    const { rows: dupe } = await pool.query(
      "SELECT id FROM students WHERE admission_number = $1",
      [d.admissionNumber]
    );
    if (dupe.length > 0) {
      throw new ApiError(409, "DUPLICATE_ADMISSION_NUMBER", "A student with this admission number already exists");
    }

    const result = await withTransaction(async (client) => {
      const publicId = await nextPublicId(client, "student", "STU");
      const { rows } = await client.query(
        `INSERT INTO students
           (public_id, admission_number, first_name, middle_name, last_name, dob, gender,
            blood_group, mobile, email, permanent_address, current_address, nationality,
            department_id, course_id, current_year_of_study, previous_institution,
            previous_qualification, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)
         RETURNING *`,
        [
          publicId, d.admissionNumber, d.firstName, d.middleName ?? null, d.lastName, d.dob, d.gender,
          d.bloodGroup ?? null, d.mobile, d.email ?? null, d.permanentAddress ?? null, d.currentAddress ?? null,
          d.nationality ?? null, d.departmentId, d.courseId, d.currentYearOfStudy, d.previousInstitution ?? null,
          d.previousQualification ?? null, req.user!.userId,
        ]
      );
      const student = rows[0];

      await client.query(
        `INSERT INTO student_academic_history
           (student_id, department_id, course_id, year_of_study, event_type, recorded_by)
         VALUES ($1,$2,$3,$4,'enrolled',$5)`,
        [student.id, d.departmentId, d.courseId, d.currentYearOfStudy, req.user!.userId]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json)
         VALUES ($1, 'CREATE', 'student', $2, $3::jsonb)`,
        [req.user!.userId, publicId, JSON.stringify(student)]
      );

      return student;
    });

    res.status(201).json({ success: true, data: result });
  })
);

// ---------- Get one (full profile) ----------
studentsRouter.get(
  "/:studentId",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.*, d.name AS department_name, c.name AS course_name
       FROM students s
       JOIN departments d ON d.id = s.department_id
       JOIN courses c ON c.id = s.course_id
       WHERE s.id::text = $1 OR s.public_id = $1`,
      [req.params.studentId]
    );
    if (rows.length === 0) throw new ApiError(404, "NOT_FOUND", "Student not found");

    const student = rows[0];

    const { rows: guardians } = await pool.query(
      "SELECT id, relationship, name, contact_number, email FROM student_guardians WHERE student_id = $1",
      [student.id]
    );

    const { rows: documents } = await pool.query(
      `SELECT id, doc_type, original_name, mime_type, size_bytes, verified_status,
              is_active, uploaded_at
       FROM student_documents WHERE student_id = $1 ORDER BY uploaded_at DESC`,
      [student.id]
    );

    const { rows: history } = await pool.query(
      `SELECT h.id, h.event_type, h.year_of_study, h.effective_date,
              d.name AS department_name, c.name AS course_name
       FROM student_academic_history h
       JOIN departments d ON d.id = h.department_id
       JOIN courses c ON c.id = h.course_id
       WHERE h.student_id = $1
       ORDER BY h.effective_date DESC, h.id DESC`,
      [student.id]
    );

    res.json({ success: true, data: { ...student, guardians, documents, history } });
  })
);

// ---------- Update ----------
const updateSchema = createSchema.partial().omit({ admissionNumber: true });

studentsRouter.put(
  "/:studentId",
  requireRole("admin", "hod"),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid student payload", parsed.error.flatten());
    }

    const { rows: before } = await pool.query("SELECT * FROM students WHERE id = $1", [req.params.studentId]);
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Student not found");

    const d = parsed.data;
    const fields: Record<string, unknown> = {
      first_name: d.firstName,
      middle_name: d.middleName,
      last_name: d.lastName,
      dob: d.dob,
      gender: d.gender,
      blood_group: d.bloodGroup,
      mobile: d.mobile,
      email: d.email,
      permanent_address: d.permanentAddress,
      current_address: d.currentAddress,
      nationality: d.nationality,
      previous_institution: d.previousInstitution,
      previous_qualification: d.previousQualification,
    };

    const setClauses: string[] = [];
    const params: unknown[] = [];
    for (const [column, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      params.push(value);
      setClauses.push(`${column} = $${params.length}`);
    }
    if (setClauses.length === 0) {
      res.json({ success: true, data: before[0] });
      return;
    }
    params.push(req.user!.userId);
    setClauses.push(`updated_by = $${params.length}`, "updated_at = now()");
    params.push(req.params.studentId);

    const { rows } = await pool.query(
      `UPDATE students SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'UPDATE', 'student', $2, $3::jsonb, $4::jsonb)`,
      [req.user!.userId, before[0].public_id, JSON.stringify(before[0]), JSON.stringify(rows[0])]
    );

    res.json({ success: true, data: rows[0] });
  })
);

// ---------- Active / Inactive toggle ----------
studentsRouter.patch(
  "/:studentId/status",
  requireRole("admin", "hod"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ isActive: z.boolean(), reason: z.string().max(500).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required");

    const { rows: before } = await pool.query("SELECT * FROM students WHERE id = $1", [req.params.studentId]);
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Student not found");

    const { rows } = await pool.query(
      "UPDATE students SET is_active = $1, updated_at = now(), updated_by = $2 WHERE id = $3 RETURNING *",
      [parsed.data.isActive, req.user!.userId, req.params.studentId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason)
       VALUES ($1, 'STATUS_CHANGE', 'student', $2, $3::jsonb, $4::jsonb, $5)`,
      [req.user!.userId, before[0].public_id, JSON.stringify(before[0]), JSON.stringify(rows[0]), parsed.data.reason ?? null]
    );

    res.json({ success: true, data: rows[0] });
  })
);

// ---------- Document upload ----------
studentsRouter.post(
  "/:studentId/documents",
  requireRole("admin", "hod"),
  uploadSingle("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "FILE_REQUIRED", "No file uploaded");

    const docType = (req.body.docType as string | undefined)?.trim();
    if (!docType) throw new ApiError(400, "VALIDATION_ERROR", "docType is required");

    const { rows: student } = await pool.query("SELECT id FROM students WHERE id = $1", [req.params.studentId]);
    if (student.length === 0) throw new ApiError(404, "NOT_FOUND", "Student not found");

    const relativePath = path
      .relative(process.cwd(), req.file.path)
      .split(path.sep)
      .join("/");

    const { rows } = await pool.query(
      `INSERT INTO student_documents
         (student_id, doc_type, original_name, stored_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, doc_type, original_name, mime_type, size_bytes, verified_status, is_active, uploaded_at`,
      [req.params.studentId, docType, req.file.originalname, relativePath, req.file.mimetype, req.file.size, req.user!.userId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json)
       VALUES ($1, 'UPLOAD_DOCUMENT', 'student_document', $2, $3::jsonb)`,
      [req.user!.userId, String(rows[0].id), JSON.stringify(rows[0])]
    );

    res.status(201).json({ success: true, data: rows[0] });
  })
);

// ---------- Document list ----------
studentsRouter.get(
  "/:studentId/documents",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, doc_type, original_name, mime_type, size_bytes, verified_status, is_active, uploaded_at
       FROM student_documents WHERE student_id = $1 ORDER BY uploaded_at DESC`,
      [req.params.studentId]
    );
    res.json({ success: true, data: rows });
  })
);

// ---------- Document view/download ----------
studentsRouter.get(
  "/:studentId/documents/:docId/file",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM student_documents WHERE id = $1 AND student_id = $2",
      [req.params.docId, req.params.studentId]
    );
    if (rows.length === 0) throw new ApiError(404, "NOT_FOUND", "Document not found");

    const doc = rows[0];
    const absolutePath = path.resolve(process.cwd(), doc.stored_path);
    // stored_path is always written by our own upload handler as a path under
    // UPLOAD_ROOT, but double-check it didn't escape that root before serving.
    if (!absolutePath.startsWith(UPLOAD_ROOT) || !fs.existsSync(absolutePath)) {
      throw new ApiError(404, "FILE_MISSING", "File no longer exists on disk");
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, 'VIEW_DOCUMENT', 'student_document', $2)`,
      [req.user!.userId, String(doc.id)]
    );

    res.setHeader("Content-Type", doc.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.original_name)}"`);
    fs.createReadStream(absolutePath).pipe(res);
  })
);

// ---------- Document active/inactive (soft delete) ----------
studentsRouter.patch(
  "/:studentId/documents/:docId/status",
  requireRole("admin", "hod"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "isActive boolean is required");

    const { rows: before } = await pool.query(
      "SELECT * FROM student_documents WHERE id = $1 AND student_id = $2",
      [req.params.docId, req.params.studentId]
    );
    if (before.length === 0) throw new ApiError(404, "NOT_FOUND", "Document not found");

    const { rows } = await pool.query(
      `UPDATE student_documents SET is_active = $1 WHERE id = $2
       RETURNING id, doc_type, original_name, mime_type, size_bytes, verified_status, is_active, uploaded_at`,
      [parsed.data.isActive, req.params.docId]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'STATUS_CHANGE', 'student_document', $2, $3::jsonb, $4::jsonb)`,
      [req.user!.userId, String(before[0].id), JSON.stringify(before[0]), JSON.stringify(rows[0])]
    );

    res.json({ success: true, data: rows[0] });
  })
);
