import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { authHeader, loginAsAdmin } from "./helpers";

describe("guardians, parent/student scoping, and progress-card signatures", () => {
  let adminToken: string;
  let departmentId: number;
  let courseId: number;
  let studentId: number;
  let otherStudentId: number;
  let parentEmail: string;
  let parentPassword = "Parent@12345";
  let parentToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    const dept = await request(app)
      .post("/api/departments")
      .set(authHeader(adminToken))
      .send({ name: "PC-Test Department" });
    departmentId = dept.body.data.id;

    const course = await request(app)
      .post("/api/courses")
      .set(authHeader(adminToken))
      .send({ name: "PC-Test Course", departmentId, durationYears: 3 });
    courseId = course.body.data.id;

    const student = await request(app)
      .post("/api/students")
      .set(authHeader(adminToken))
      .send({
        firstName: "Guardian",
        lastName: "Linked",
        dob: "2006-01-01",
        gender: "male",
        mobile: "9000000001",
        departmentId,
        courseId,
        admissionNumber: "PC-TEST-001",
      });
    studentId = student.body.data.id;

    const otherStudent = await request(app)
      .post("/api/students")
      .set(authHeader(adminToken))
      .send({
        firstName: "Other",
        lastName: "Student",
        dob: "2006-01-01",
        gender: "female",
        mobile: "9000000002",
        departmentId,
        courseId,
        admissionNumber: "PC-TEST-002",
      });
    otherStudentId = otherStudent.body.data.id;

    parentEmail = `parent-${Date.now()}@example.test`;
    await request(app)
      .post(`/api/students/${studentId}/guardians`)
      .set(authHeader(adminToken))
      .send({
        relationship: "mother",
        name: "Guardian Mom",
        email: parentEmail,
        createLogin: true,
        password: parentPassword,
      });

    const parentLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: parentEmail, password: parentPassword });
    parentToken = parentLogin.body.data.accessToken;
  });

  it("creating a guardian without createLogin does not create a users row", async () => {
    const res = await request(app)
      .post(`/api/students/${studentId}/guardians`)
      .set(authHeader(adminToken))
      .send({ relationship: "father", name: "Guardian Dad", contactNumber: "9000000099" });
    expect(res.status).toBe(201);
    expect(res.body.data.has_login).toBe(false);
  });

  it("requires a password when createLogin is true", async () => {
    const res = await request(app)
      .post(`/api/students/${studentId}/guardians`)
      .set(authHeader(adminToken))
      .send({ relationship: "father", name: "No Password", email: "nopass@example.test", createLogin: true });
    expect(res.status).toBe(400);
  });

  it("parent can view their linked child's profile", async () => {
    const res = await request(app).get(`/api/students/${studentId}`).set(authHeader(parentToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(studentId);
  });

  it("parent cannot view a student they are not linked to", async () => {
    const res = await request(app).get(`/api/students/${otherStudentId}`).set(authHeader(parentToken));
    expect(res.status).toBe(403);
  });

  it("parent's student list only contains their own children", async () => {
    const res = await request(app).get("/api/students?includeInactive=true").set(authHeader(parentToken));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s: { id: number }) => s.id);
    expect(ids).toContain(studentId);
    expect(ids).not.toContain(otherStudentId);
  });

  it("parent cannot create a department (still staff-only)", async () => {
    const res = await request(app)
      .post("/api/departments")
      .set(authHeader(parentToken))
      .send({ name: "Should Not Be Created" });
    expect(res.status).toBe(403);
  });

  describe("progress card dual signature", () => {
    let cardId: number;

    it("staff creates a progress card (starts awaiting_signatures)", async () => {
      const res = await request(app)
        .post(`/api/students/${studentId}/progress-cards`)
        .set(authHeader(adminToken))
        .send({ term: "Term 1", remarks: "Doing well" });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("awaiting_signatures");
      cardId = res.body.data.id;
    });

    it("a parent cannot sign before the teacher does on a card for someone else's child", async () => {
      const res = await request(app)
        .patch(`/api/students/${otherStudentId}/progress-cards/${cardId}/sign-parent`)
        .set(authHeader(parentToken));
      // Either the card doesn't belong to that student (404) or ownership fails (403) —
      // either way, cross-student signing must never succeed.
      expect([403, 404]).toContain(res.status);
    });

    it("staff signs as teacher; still awaiting parent signature", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentId}/progress-cards/${cardId}/sign-teacher`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.teacher_signed_at).toBeTruthy();
      expect(res.body.data.status).toBe("awaiting_signatures");
    });

    it("rejects a second teacher signature on the same card", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentId}/progress-cards/${cardId}/sign-teacher`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(409);
    });

    it("a student/non-parent role cannot sign as parent", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentId}/progress-cards/${cardId}/sign-parent`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(403);
    });

    it("the linked parent signs; card becomes fully_signed", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentId}/progress-cards/${cardId}/sign-parent`)
        .set(authHeader(parentToken));
      expect(res.status).toBe(200);
      expect(res.body.data.parent_signed_at).toBeTruthy();
      expect(res.body.data.status).toBe("fully_signed");
    });

    it("rejects a second parent signature on the same card", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentId}/progress-cards/${cardId}/sign-parent`)
        .set(authHeader(parentToken));
      expect(res.status).toBe(409);
    });
  });

  describe("student self-service login", () => {
    const studentPassword = "StudentLogin@123";

    it("requires the student to have an email before creating a login", async () => {
      const res = await request(app)
        .post(`/api/students/${studentId}/login`)
        .set(authHeader(adminToken))
        .send({ password: studentPassword });
      expect(res.status).toBe(422);
    });

    it("creates a student login once an email is on file, and the student can then log in and see only themselves", async () => {
      const email = `student-${Date.now()}@example.test`;
      await request(app)
        .put(`/api/students/${studentId}`)
        .set(authHeader(adminToken))
        .send({ email });

      const created = await request(app)
        .post(`/api/students/${studentId}/login`)
        .set(authHeader(adminToken))
        .send({ password: studentPassword });
      expect(created.status).toBe(201);

      const login = await request(app).post("/api/auth/login").send({ email, password: studentPassword });
      expect(login.status).toBe(200);
      const studentToken = login.body.data.accessToken;

      const own = await request(app).get(`/api/students/${studentId}`).set(authHeader(studentToken));
      expect(own.status).toBe(200);

      const other = await request(app).get(`/api/students/${otherStudentId}`).set(authHeader(studentToken));
      expect(other.status).toBe(403);
    });
  });
});
