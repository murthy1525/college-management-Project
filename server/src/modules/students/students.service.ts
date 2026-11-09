import fs from "fs";
import path from "path";
import argon2 from "argon2";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import { AccessTokenPayload } from "../../utils/jwt";
import { nextPublicId } from "../../utils/idGenerator";
import * as coursesRepository from "../courses/courses.repository";
import * as guardiansRepository from "../guardians/guardians.repository";
import * as studentsRepository from "./students.repository";
import * as documentsRepository from "./students.documents.repository";
import * as historyRepository from "./students.history.repository";
import { allowedStudentIds, assertCanAccessStudent } from "./students.access";
import { resolveDocumentPath, safeStudentDir } from "./students.upload";
import { detectFileType } from "../../utils/fileSignature";
import { CreateStudentInput, UpdateStudentInput } from "./students.validators";
import { Student, StudentListFilters } from "./students.types";

export async function listStudents(caller: AccessTokenPayload, filters: StudentListFilters) {
  const restrictToIds = await allowedStudentIds(caller);
  return studentsRepository.findAll(pool, filters, restrictToIds);
}

export async function createStudent(userId: number, input: CreateStudentInput): Promise<Student> {
  const course = await coursesRepository.findActiveCourseById(pool, input.courseId);
  if (!course) throw new ApiError(422, "INVALID_COURSE", "Course does not exist or is inactive");
  if (course.department_id !== input.departmentId) {
    throw new ApiError(422, "COURSE_DEPARTMENT_MISMATCH", "Course does not belong to the selected department");
  }

  const duplicate = await studentsRepository.findByAdmissionNumber(pool, input.admissionNumber);
  if (duplicate) {
    throw new ApiError(409, "DUPLICATE_ADMISSION_NUMBER", "A student with this admission number already exists");
  }

  return withTransaction(async (client) => {
    const student = await studentsRepository.insert(client, input, userId);

    await historyRepository.recordEvent(client, {
      studentId: student.id,
      departmentId: input.departmentId,
      courseId: input.courseId,
      yearOfStudy: input.currentYearOfStudy,
      eventType: "enrolled",
      recordedBy: userId,
    });

    await recordAudit(client, {
      userId,
      action: "CREATE",
      entityType: "student",
      entityId: student.public_id,
      after: student,
    });

    return student;
  });
}

export async function getStudentProfile(caller: AccessTokenPayload, idOrPublicId: string) {
  const student = await studentsRepository.findByIdOrPublicId(pool, idOrPublicId);
  if (!student) throw new ApiError(404, "NOT_FOUND", "Student not found");

  await assertCanAccessStudent(caller, student.id);

  const [documents, history, guardians] = await Promise.all([
    documentsRepository.findByStudent(pool, student.id),
    historyRepository.findByStudent(pool, student.id),
    guardiansRepository.findByStudent(pool, student.id),
  ]);

  return { ...student, documents, history, guardians };
}

export async function updateStudent(userId: number, id: string, input: UpdateStudentInput): Promise<Student> {
  const before = await studentsRepository.findRawById(pool, id);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Student not found");

  const after = await studentsRepository.updateFields(pool, id, input, userId);

  await recordAudit(pool, {
    userId,
    action: "UPDATE",
    entityType: "student",
    entityId: before.public_id,
    before,
    after,
  });

  return after!;
}

export async function setStudentStatus(
  userId: number,
  id: string,
  isActive: boolean,
  reason?: string
): Promise<Student> {
  const before = await studentsRepository.findRawById(pool, id);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Student not found");

  const after = await studentsRepository.updateStatus(pool, id, isActive, userId);

  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "student",
    entityId: before.public_id,
    before,
    after,
    reason,
  });

  return after!;
}

export async function listDocuments(caller: AccessTokenPayload, studentId: string) {
  await assertCanAccessStudent(caller, Number(studentId));
  return documentsRepository.findByStudent(pool, studentId);
}

export async function uploadDocument(
  userId: number,
  studentId: string,
  docType: string,
  file: Express.Multer.File
) {
  const student = await studentsRepository.findRawById(pool, studentId);
  if (!student) throw new ApiError(404, "NOT_FOUND", "Student not found");

  // The client-supplied Content-Type and the original filename's extension
  // are both attacker-controlled and easily spoofed — the actual bytes are
  // what get trusted for both the stored MIME type and the file extension
  // multer writes are never used.
  const detected = detectFileType(file.buffer);
  if (!detected) {
    throw new ApiError(400, "INVALID_FILE_TYPE", "Only JPG, PNG, or PDF files are allowed");
  }

  const dir = safeStudentDir(studentId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${detected.extension}`;
  const absolutePath = path.join(dir, filename);
  fs.writeFileSync(absolutePath, file.buffer);

  const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");

  const document = await documentsRepository.insert(pool, {
    studentId,
    docType,
    originalName: file.originalname,
    storedPath: relativePath,
    mimeType: detected.mimeType,
    sizeBytes: file.size,
    uploadedBy: userId,
  });

  await recordAudit(pool, {
    userId,
    action: "UPLOAD_DOCUMENT",
    entityType: "student_document",
    entityId: String(document.id),
    after: document,
  });

  return document;
}

export async function getDocumentFile(caller: AccessTokenPayload, studentId: string, docId: string) {
  await assertCanAccessStudent(caller, Number(studentId));

  const doc = await documentsRepository.findOne(pool, studentId, docId);
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found");

  const absolutePath = resolveDocumentPath(doc.stored_path);
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, "FILE_MISSING", "File no longer exists on disk");
  }

  await recordAudit(pool, {
    userId: caller.userId,
    action: "VIEW_DOCUMENT",
    entityType: "student_document",
    entityId: String(doc.id),
  });

  return { absolutePath, mimeType: doc.mime_type, originalName: doc.original_name };
}

export async function createStudentLogin(actingUserId: number, studentId: string, password: string): Promise<void> {
  const student = await studentsRepository.findRawById(pool, studentId);
  if (!student) throw new ApiError(404, "NOT_FOUND", "Student not found");
  if (student.user_id) throw new ApiError(409, "LOGIN_EXISTS", "This student already has a login");
  if (!student.email) {
    throw new ApiError(422, "EMAIL_REQUIRED", "Student must have an email on file before a login can be created");
  }

  await withTransaction(async (client) => {
    const { rows: existing } = await client.query("SELECT id FROM users WHERE email = $1", [student.email]);
    if (existing.length > 0) throw new ApiError(409, "EMAIL_IN_USE", "A login with this email already exists");

    const { rows: roleRows } = await client.query("SELECT id FROM roles WHERE code = 'student'");
    if (roleRows.length === 0) throw new ApiError(500, "ROLE_MISSING", "The 'student' role is not configured");

    const publicId = await nextPublicId(client, "student_user", "USR");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const { rows: userRows } = await client.query(
      `INSERT INTO users (public_id, email, password_hash, status) VALUES ($1,$2,$3,'active') RETURNING id`,
      [publicId, student.email, passwordHash]
    );
    const newUserId = userRows[0].id;

    await client.query("INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)", [newUserId, roleRows[0].id]);
    await client.query("UPDATE students SET user_id = $1 WHERE id = $2", [newUserId, studentId]);

    await recordAudit(client, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "student_login",
      entityId: String(studentId),
    });
  });
}

export async function setDocumentStatus(userId: number, studentId: string, docId: string, isActive: boolean) {
  const before = await documentsRepository.findOne(pool, studentId, docId);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Document not found");

  const after = await documentsRepository.updateStatus(pool, docId, isActive);

  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "student_document",
    entityId: String(before.id),
    before,
    after,
  });

  return after!;
}
