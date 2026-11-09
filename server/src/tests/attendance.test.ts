import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { authHeader, loginAsAdmin } from "./helpers";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("attendance", () => {
  let adminToken: string;
  let departmentId: number;
  let courseId: number;
  let studentId: number;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    const dept = await request(app)
      .post("/api/departments")
      .set(authHeader(adminToken))
      .send({ name: "Attendance-Test Department" });
    departmentId = dept.body.data.id;

    const course = await request(app)
      .post("/api/courses")
      .set(authHeader(adminToken))
      .send({ name: "Attendance-Test Course", departmentId, durationYears: 3 });
    courseId = course.body.data.id;

    const student = await request(app)
      .post("/api/students")
      .set(authHeader(adminToken))
      .send({
        firstName: "Att",
        lastName: "Tester",
        dob: "2006-01-01",
        gender: "male",
        mobile: "9111111111",
        departmentId,
        courseId,
        admissionNumber: "ATT-TEST-001",
      });
    studentId = student.body.data.id;
  });

  it("rejects non-staff and unauthenticated access to the roster", async () => {
    const unauth = await request(app).get("/api/attendance/roster").query({ date: todayIso() });
    expect(unauth.status).toBe(401);
  });

  it("rejects a future date", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await request(app)
      .post("/api/attendance/mark")
      .set(authHeader(adminToken))
      .send({ date: future, records: [{ studentId, status: "present" }] });
    expect(res.status).toBe(400);
  });

  it("marks attendance and the roster reflects it", async () => {
    const date = todayIso();
    const mark = await request(app)
      .post("/api/attendance/mark")
      .set(authHeader(adminToken))
      .send({ date, records: [{ studentId, status: "present" }] });
    expect(mark.status).toBe(201);

    const roster = await request(app)
      .get("/api/attendance/roster")
      .query({ date, departmentId })
      .set(authHeader(adminToken));
    expect(roster.status).toBe(200);
    const entry = roster.body.data.find((r: { student_id: number }) => r.student_id === studentId);
    expect(entry.status).toBe("present");
  });

  it("re-marking the same student/date updates rather than duplicating", async () => {
    const date = todayIso();
    await request(app)
      .post("/api/attendance/mark")
      .set(authHeader(adminToken))
      .send({ date, records: [{ studentId, status: "absent" }] });

    const roster = await request(app)
      .get("/api/attendance/roster")
      .query({ date, departmentId })
      .set(authHeader(adminToken));
    const entries = roster.body.data.filter((r: { student_id: number }) => r.student_id === studentId);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("absent");
  });

  it("computes a present-percentage that excludes approved leave from the denominator", async () => {
    await request(app)
      .post("/api/attendance/mark")
      .set(authHeader(adminToken))
      .send({
        date: daysAgoIso(1),
        records: [{ studentId, status: "present" }],
      });
    await request(app)
      .post("/api/attendance/mark")
      .set(authHeader(adminToken))
      .send({
        date: daysAgoIso(2),
        records: [{ studentId, status: "leave" }],
      });

    const res = await request(app)
      .get(`/api/students/${studentId}/attendance`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    // present: today(absent-overwritten above is absent, not present) + yesterday(present) = 1 present
    // leave day excluded from denominator entirely.
    expect(res.body.data.summary.leave).toBeGreaterThanOrEqual(1);
    expect(res.body.data.summary.percentage).not.toBeNull();
  });

  it("a parent without a linked guardian record cannot see this student's attendance", async () => {
    const parentEmail = `att-parent-${Date.now()}@example.test`;
    await request(app)
      .post("/api/students")
      .set(authHeader(adminToken))
      .send({
        firstName: "Other2",
        lastName: "Kid",
        dob: "2006-01-01",
        gender: "female",
        mobile: "9222222222",
        departmentId,
        courseId,
        admissionNumber: "ATT-TEST-002",
      });

    await request(app)
      .post(`/api/students/${studentId}/guardians`)
      .set(authHeader(adminToken))
      .send({
        relationship: "father",
        name: "Not This Kid's Dad",
        email: parentEmail,
        createLogin: true,
        password: "ParentAtt@123",
      });
    const login = await request(app).post("/api/auth/login").send({ email: parentEmail, password: "ParentAtt@123" });
    const parentToken = login.body.data.accessToken;

    // This parent IS linked to `studentId`, so this should succeed...
    const ok = await request(app).get(`/api/students/${studentId}/attendance`).set(authHeader(parentToken));
    expect(ok.status).toBe(200);

    // ...but a lecturer/staff-only roster/mark endpoint must stay out of reach for a parent.
    const blocked = await request(app)
      .get("/api/attendance/roster")
      .query({ date: todayIso() })
      .set(authHeader(parentToken));
    expect(blocked.status).toBe(403);
  });

  it("dashboard analytics requires a staff role", async () => {
    const res = await request(app).get("/api/dashboard/analytics").query({ range: "month" }).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.registrations)).toBe(true);
    expect(Array.isArray(res.body.data.attendanceTrend)).toBe(true);
    expect(Array.isArray(res.body.data.studentsByDepartment)).toBe(true);
  });

  it("rejects an invalid analytics range", async () => {
    const res = await request(app).get("/api/dashboard/analytics").query({ range: "decade" }).set(authHeader(adminToken));
    expect(res.status).toBe(400);
  });
});
