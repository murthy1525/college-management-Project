import { Queryable } from "../../config/db";
import { StaffRoleCode, StaffUser } from "./staff.types";

export async function findAll(db: Queryable): Promise<StaffUser[]> {
  const { rows } = await db.query(
    `SELECT u.id, u.public_id, u.email, u.full_name, u.status,
            array_agg(r.code ORDER BY r.code) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.code IN ('admin','hod','lecturer','principal')
     GROUP BY u.id
     ORDER BY u.full_name NULLS LAST, u.email`
  );
  return rows;
}

export async function findByEmail(db: Queryable, email: string): Promise<{ id: number } | null> {
  const { rows } = await db.query("SELECT id FROM users WHERE email = $1", [email]);
  return rows[0] ?? null;
}

export async function findRoleId(db: Queryable, code: StaffRoleCode): Promise<number | null> {
  const { rows } = await db.query("SELECT id FROM roles WHERE code = $1", [code]);
  return rows[0]?.id ?? null;
}

export async function insertUser(
  db: Queryable,
  data: { publicId: string; email: string; fullName: string; passwordHash: string }
): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO users (public_id, email, full_name, password_hash, status)
     VALUES ($1,$2,$3,$4,'active') RETURNING id`,
    [data.publicId, data.email, data.fullName, data.passwordHash]
  );
  return rows[0].id;
}

export async function assignRole(db: Queryable, userId: number, roleId: number): Promise<void> {
  await db.query("INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)", [userId, roleId]);
}

export async function findOne(db: Queryable, userId: string): Promise<StaffUser | null> {
  const { rows } = await db.query(
    `SELECT u.id, u.public_id, u.email, u.full_name, u.status,
            array_agg(r.code ORDER BY r.code) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateStatus(
  db: Queryable,
  userId: string,
  status: "active" | "disabled"
): Promise<void> {
  await db.query("UPDATE users SET status = $1, updated_at = now() WHERE id = $2", [status, userId]);
}
