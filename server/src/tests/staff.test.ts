import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { authHeader, loginAsAdmin } from "./helpers";

describe("staff logins", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it("rejects non-admin creation of a staff login", async () => {
    // A lecturer token shouldn't even exist yet in this suite, so prove the
    // route is admin-only by hitting it unauthenticated first.
    const res = await request(app).post("/api/staff").send({
      fullName: "Nope",
      email: `nope-${Date.now()}@example.test`,
      password: "Password@123",
      role: "lecturer",
    });
    expect(res.status).toBe(401);
  });

  it("creates a lecturer login with a generated public_id and lets them log in", async () => {
    const email = `lecturer-${Date.now()}@example.test`;
    const create = await request(app)
      .post("/api/staff")
      .set(authHeader(adminToken))
      .send({ fullName: "Dr. Rao", email, password: "LecturerPass@123", role: "lecturer" });

    expect(create.status).toBe(201);
    expect(create.body.data.public_id).toMatch(/^LEC\d{7}$/);
    expect(create.body.data.roles).toEqual(["lecturer"]);
    expect(create.body.data.full_name).toBe("Dr. Rao");

    const login = await request(app).post("/api/auth/login").send({ email, password: "LecturerPass@123" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toContain("lecturer");
    expect(login.body.data.user.fullName).toBe("Dr. Rao");

    const lecturerToken = login.body.data.accessToken;

    // A lecturer is staff for student-access purposes, but not for managing masters.
    const createDept = await request(app)
      .post("/api/departments")
      .set(authHeader(lecturerToken))
      .send({ name: "Should Not Be Created" });
    expect(createDept.status).toBe(403);

    const createStaff = await request(app)
      .post("/api/staff")
      .set(authHeader(lecturerToken))
      .send({ fullName: "X", email: "x@example.test", password: "Password@123", role: "admin" });
    expect(createStaff.status).toBe(403);
  });

  it("rejects a duplicate email", async () => {
    const email = `dup-staff-${Date.now()}@example.test`;
    await request(app)
      .post("/api/staff")
      .set(authHeader(adminToken))
      .send({ fullName: "First", email, password: "Password@123", role: "hod" });

    const dupe = await request(app)
      .post("/api/staff")
      .set(authHeader(adminToken))
      .send({ fullName: "Second", email, password: "Password@123", role: "hod" });
    expect(dupe.status).toBe(409);
  });

  it("rejects an invalid role", async () => {
    const res = await request(app)
      .post("/api/staff")
      .set(authHeader(adminToken))
      .send({
        fullName: "Bad Role",
        email: `badrole-${Date.now()}@example.test`,
        password: "Password@123",
        role: "student",
      });
    expect(res.status).toBe(400);
  });

  it("disables and re-enables a staff login, and the disabled account can no longer log in", async () => {
    const email = `disable-${Date.now()}@example.test`;
    const create = await request(app)
      .post("/api/staff")
      .set(authHeader(adminToken))
      .send({ fullName: "To Disable", email, password: "Password@123", role: "lecturer" });
    const userId = create.body.data.id;

    const disabled = await request(app)
      .patch(`/api/staff/${userId}/status`)
      .set(authHeader(adminToken))
      .send({ status: "disabled" });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.status).toBe("disabled");

    const blockedLogin = await request(app).post("/api/auth/login").send({ email, password: "Password@123" });
    expect(blockedLogin.status).toBe(403);

    const reenabled = await request(app)
      .patch(`/api/staff/${userId}/status`)
      .set(authHeader(adminToken))
      .send({ status: "active" });
    expect(reenabled.status).toBe(200);

    const workingLogin = await request(app).post("/api/auth/login").send({ email, password: "Password@123" });
    expect(workingLogin.status).toBe(200);
  });

  it("will not let an admin disable their own account", async () => {
    const me = await request(app).get("/api/auth/me").set(authHeader(adminToken));
    const res = await request(app)
      .patch(`/api/staff/${me.body.data.userId}/status`)
      .set(authHeader(adminToken))
      .send({ status: "disabled" });
    expect(res.status).toBe(422);
  });

  it("lists only staff roles, not students/parents", async () => {
    const res = await request(app).get("/api/staff").set(authHeader(adminToken));
    expect(res.status).toBe(200);
    for (const entry of res.body.data) {
      expect(entry.roles.some((r: string) => ["admin", "hod", "lecturer", "principal"].includes(r))).toBe(true);
    }
  });
});
