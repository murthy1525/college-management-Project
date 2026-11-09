/**
 * Bootstrap seed — NOT sample/dummy business data.
 * Creates only what the system cannot function without:
 *   - role + permission definitions (the RBAC catalog itself)
 *   - one admin login so there is a way to sign in for the first time
 * No departments/courses/students/lecturers are created here — those are
 * created dynamically through the application by an authenticated admin.
 */
import argon2 from "argon2";
import { pool } from "../config/db";
import { env } from "../config/env";

const ROLES = [
  { code: "principal", name: "Principal" },
  { code: "admin", name: "Administrator" },
  { code: "hod", name: "Head of Department" },
  { code: "lecturer", name: "Lecturer" },
  { code: "student", name: "Student" },
];

const PERMISSIONS = [
  "department.manage",
  "course.manage",
  "student.manage",
  "student.view",
  "student.document.upload",
  "student.document.view",
  "dashboard.view",
];

async function main() {
  for (const role of ROLES) {
    await pool.query(
      `INSERT INTO roles (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [role.code, role.name]
    );
  }

  for (const code of PERMISSIONS) {
    await pool.query(
      `INSERT INTO permissions (code, description) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [code, code.replace(/\./g, " ")]
    );
  }

  const { rows: adminRoleRows } = await pool.query(
    "SELECT id FROM roles WHERE code = 'admin'"
  );
  const adminRoleId: number = adminRoleRows[0].id;

  const { rows: allPerms } = await pool.query("SELECT id FROM permissions");
  for (const p of allPerms) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminRoleId, p.id]
    );
  }

  const { rows: existingAdmin } = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [env.seedAdminEmail]
  );

  if (existingAdmin.length === 0) {
    const passwordHash = await argon2.hash(env.seedAdminPassword, {
      type: argon2.argon2id,
    });
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (public_id, email, password_hash, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      ["ADM0001", env.seedAdminEmail, passwordHash]
    );
    const userId = userRows[0].id;
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [userId, adminRoleId]
    );
    console.log(`Created admin login: ${env.seedAdminEmail}`);
  } else {
    console.log("Admin login already exists, skipping.");
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
