import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app";
import { pool } from "../config/db";

describe("auth", () => {
  afterAll(async () => {
    // Undo any lockout this file triggered so later test files can still log in.
    await pool.query(
      "UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email = 'admin@cms.local'"
    );
  });

  it("rejects an unknown email with a generic message (no account enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@cms.local", password: "whatever" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a wrong password with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@cms.local", password: "wrongpass" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("does not crash the process on a failed login (async error must reach the error middleware)", async () => {
    await request(app).post("/api/auth/login").send({ email: "admin@cms.local", password: "bad" });
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
  });

  it("logs in successfully with correct credentials and returns a usable token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@cms.local", password: "Admin@12345" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.roles).toContain("admin");

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("admin@cms.local");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = jwt.sign({ userId: 1, roles: ["admin"] }, "wrong-secret", { expiresIn: "5m" });
    const res = await request(app).get("/api/departments").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("enforces RBAC even with a validly-signed token for a lower-privilege role", async () => {
    const forged = jwt.sign(
      { userId: 999, publicId: "STU9999999", email: "fake@student.local", roles: ["student"] },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "5m" }
    );
    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${forged}`)
      .send({ name: "Hacked Dept" });
    expect(res.status).toBe(403);
  });

  it("locks the account after repeated failed attempts, even for the correct password", async () => {
    for (let i = 0; i < 4; i++) {
      await request(app).post("/api/auth/login").send({ email: "admin@cms.local", password: "wrong" });
    }
    const lockedRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@cms.local", password: "wrong" });
    expect(lockedRes.status).toBe(423);

    const stillLocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@cms.local", password: "Admin@12345" });
    expect(stillLocked.status).toBe(423);
    expect(stillLocked.body.error.code).toBe("ACCOUNT_LOCKED");
  });
});
