import request from "supertest";
import { app } from "../app";

export async function loginAsAdmin(): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@cms.local", password: "Admin@12345" });
  return res.body.data.accessToken as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
