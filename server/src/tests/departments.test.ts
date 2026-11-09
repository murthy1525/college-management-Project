import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app";
import { authHeader, loginAsAdmin } from "./helpers";

describe("departments", () => {
  let token: string;

  beforeAll(async () => {
    token = await loginAsAdmin();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/departments");
    expect(res.status).toBe(401);
  });

  it("creates a department with a generated public_id", async () => {
    const res = await request(app)
      .post("/api/departments")
      .set(authHeader(token))
      .send({ name: "Mechanical Engineering" });
    expect(res.status).toBe(201);
    expect(res.body.data.public_id).toMatch(/^DEPT\d{7}$/);
    expect(res.body.data.is_active).toBe(true);
  });

  it("rejects a name that's too short", async () => {
    const res = await request(app).post("/api/departments").set(authHeader(token)).send({ name: "X" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists only active departments by default, and includes inactive when asked", async () => {
    const created = await request(app)
      .post("/api/departments")
      .set(authHeader(token))
      .send({ name: "Temporary Dept For Toggle Test" });
    const id = created.body.data.id;

    await request(app).patch(`/api/departments/${id}/status`).set(authHeader(token)).send({ isActive: false });

    const defaultList = await request(app).get("/api/departments").set(authHeader(token));
    expect(defaultList.body.data.some((d: { id: number }) => d.id === id)).toBe(false);

    const fullList = await request(app).get("/api/departments?includeInactive=true").set(authHeader(token));
    expect(fullList.body.data.some((d: { id: number }) => d.id === id)).toBe(true);
  });

  it("404s a status change on a department that doesn't exist", async () => {
    const res = await request(app)
      .patch("/api/departments/999999/status")
      .set(authHeader(token))
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });
});
