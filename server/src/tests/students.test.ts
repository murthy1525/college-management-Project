import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { authHeader, loginAsAdmin } from "./helpers";

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("students", () => {
  let token: string;
  let departmentId: number;
  let courseId: number;

  beforeAll(async () => {
    token = await loginAsAdmin();

    const dept = await request(app)
      .post("/api/departments")
      .set(authHeader(token))
      .send({ name: "Students-Test Department" });
    departmentId = dept.body.data.id;

    const course = await request(app)
      .post("/api/courses")
      .set(authHeader(token))
      .send({ name: "Students-Test Course", departmentId, durationYears: 4 });
    courseId = course.body.data.id;
  });

  function baseStudentPayload(admissionNumber: string) {
    return {
      firstName: "Asha",
      lastName: "Rao",
      dob: "2005-06-15",
      gender: "female",
      mobile: "9876543210",
      departmentId,
      courseId,
      currentYearOfStudy: 1,
      admissionNumber,
    };
  }

  it("creates a student with a generated public_id and records enrollment history", async () => {
    const res = await request(app)
      .post("/api/students")
      .set(authHeader(token))
      .send(baseStudentPayload("ADM-TEST-001"));
    expect(res.status).toBe(201);
    expect(res.body.data.public_id).toMatch(/^STU\d{7}$/);

    const profile = await request(app)
      .get(`/api/students/${res.body.data.id}`)
      .set(authHeader(token));
    expect(profile.body.data.history).toHaveLength(1);
    expect(profile.body.data.history[0].event_type).toBe("enrolled");
  });

  it("rejects a duplicate admission number", async () => {
    await request(app).post("/api/students").set(authHeader(token)).send(baseStudentPayload("ADM-TEST-DUP"));
    const res = await request(app)
      .post("/api/students")
      .set(authHeader(token))
      .send(baseStudentPayload("ADM-TEST-DUP"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_ADMISSION_NUMBER");
  });

  it("rejects a course that doesn't belong to the given department", async () => {
    const otherDept = await request(app)
      .post("/api/departments")
      .set(authHeader(token))
      .send({ name: "Another Department" });

    const res = await request(app)
      .post("/api/students")
      .set(authHeader(token))
      .send({ ...baseStudentPayload("ADM-TEST-MISMATCH"), departmentId: otherDept.body.data.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("COURSE_DEPARTMENT_MISMATCH");
  });

  it("stores SQL-metacharacter names literally without executing them", async () => {
    const payload = baseStudentPayload("ADM-TEST-INJ");
    payload.firstName = "Rob'); DROP TABLE students;--";
    const res = await request(app).post("/api/students").set(authHeader(token)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.first_name).toBe("Rob'); DROP TABLE students;--");

    const stillWorks = await request(app).get("/api/students").set(authHeader(token));
    expect(stillWorks.status).toBe(200);
  });

  it("handles SQL-metacharacter search input safely", async () => {
    const res = await request(app)
      .get("/api/students")
      .query({ search: "' OR '1'='1" })
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("toggles a student inactive and excludes it from the default list", async () => {
    const created = await request(app)
      .post("/api/students")
      .set(authHeader(token))
      .send(baseStudentPayload("ADM-TEST-TOGGLE"));
    const id = created.body.data.id;

    await request(app)
      .patch(`/api/students/${id}/status`)
      .set(authHeader(token))
      .send({ isActive: false, reason: "test" });

    const defaultList = await request(app).get("/api/students").set(authHeader(token));
    expect(defaultList.body.data.some((s: { id: number }) => s.id === id)).toBe(false);

    const fullList = await request(app).get("/api/students?includeInactive=true").set(authHeader(token));
    const found = fullList.body.data.find((s: { id: number }) => s.id === id);
    expect(found).toBeTruthy();
    expect(found.is_active).toBe(false);
  });

  describe("documents", () => {
    let studentId: number;

    beforeAll(async () => {
      const created = await request(app)
        .post("/api/students")
        .set(authHeader(token))
        .send(baseStudentPayload("ADM-TEST-DOCS"));
      studentId = created.body.data.id;
    });

    it("rejects unauthenticated document viewing", async () => {
      const res = await request(app).get(`/api/students/${studentId}/documents/1/file`);
      expect(res.status).toBe(401);
    });

    it("uploads a real PNG and stores/serves it using the detected type, not the client's claim", async () => {
      const upload = await request(app)
        .post(`/api/students/${studentId}/documents`)
        .set(authHeader(token))
        .field("docType", "photo")
        .attach("file", PNG_MAGIC_BYTES, { filename: "photo.png", contentType: "image/png" });
      expect(upload.status).toBe(201);
      expect(upload.body.data.mime_type).toBe("image/png");

      const docId = upload.body.data.id;
      const view = await request(app)
        .get(`/api/students/${studentId}/documents/${docId}/file`)
        .set(authHeader(token));
      expect(view.status).toBe(200);
      expect(view.headers["content-type"]).toContain("image/png");
      expect(Buffer.compare(view.body, PNG_MAGIC_BYTES)).toBe(0);
    });

    it("rejects a file whose content doesn't match its claimed type/extension (spoofed upload)", async () => {
      const notActuallyAPdf = Buffer.from("MZ this is actually an executable header, not a PDF");
      const res = await request(app)
        .post(`/api/students/${studentId}/documents`)
        .set(authHeader(token))
        .field("docType", "transfer_certificate")
        .attach("file", notActuallyAPdf, { filename: "transfer.pdf", contentType: "application/pdf" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("does not let a crafted studentId path-traverse outside the upload root", async () => {
      const res = await request(app)
        .post("/api/students/../../etc/documents")
        .set(authHeader(token))
        .field("docType", "x")
        .attach("file", PNG_MAGIC_BYTES, { filename: "x.png", contentType: "image/png" });
      // Express normalizes ".." out of the path before routing ever sees it,
      // so this either 404s (no such student id) or never matches the route.
      expect([400, 404]).toContain(res.status);
    });

    it("toggles a document inactive without losing it from the record", async () => {
      const upload = await request(app)
        .post(`/api/students/${studentId}/documents`)
        .set(authHeader(token))
        .field("docType", "photo")
        .attach("file", PNG_MAGIC_BYTES, { filename: "photo2.png", contentType: "image/png" });
      const docId = upload.body.data.id;

      const toggled = await request(app)
        .patch(`/api/students/${studentId}/documents/${docId}/status`)
        .set(authHeader(token))
        .send({ isActive: false });
      expect(toggled.status).toBe(200);
      expect(toggled.body.data.is_active).toBe(false);
    });
  });
});
