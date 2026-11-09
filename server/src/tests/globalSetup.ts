/**
 * Runs once for the whole test run, in its own process (vitest globalSetup
 * semantics) — so it sets its own env rather than relying on `test.env`
 * from vitest.config.ts, which only applies to the worker process.
 */
process.env.DATABASE_URL = "postgres://postgres@127.0.0.1:5432/cms_test";
process.env.JWT_ACCESS_SECRET = "test_access_secret";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret";
process.env.SEED_ADMIN_EMAIL = "admin@cms.local";
process.env.SEED_ADMIN_PASSWORD = "Admin@12345";

import fs from "fs";
import path from "path";
import { Pool } from "pg";

export default async function setup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

  const migrationsDir = path.join(__dirname, "../database/migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }

  // Bootstrap catalog only (roles/permissions/admin login) — same as the
  // real seed script's intent, duplicated here so tests don't depend on
  // tsx/ts-node executing the seed script as a separate process.
  const argon2 = await import("argon2");
  const { rows: roleRows } = await pool.query(
    `INSERT INTO roles (code, name) VALUES
       ('principal','Principal'), ('admin','Administrator'), ('hod','Head of Department'),
       ('lecturer','Lecturer'), ('student','Student'), ('parent','Parent / Guardian')
     RETURNING id, code`
  );
  const adminRoleId = roleRows.find((r) => r.code === "admin")!.id;

  const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD!, { type: argon2.argon2id });
  const { rows: userRows } = await pool.query(
    `INSERT INTO users (public_id, email, password_hash, status) VALUES ($1,$2,$3,'active') RETURNING id`,
    ["ADM0001", process.env.SEED_ADMIN_EMAIL, passwordHash]
  );
  await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)`, [userRows[0].id, adminRoleId]);

  await pool.end();
}
