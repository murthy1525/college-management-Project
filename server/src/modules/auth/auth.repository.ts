import { Queryable } from "../../config/db";
import { AuthUserRow } from "./auth.types";

export async function findByEmailWithRoles(db: Queryable, email: string): Promise<AuthUserRow | null> {
  const { rows } = await db.query(
    `SELECT u.id, u.public_id, u.email, u.password_hash, u.status,
            u.failed_login_count, u.locked_until,
            COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1
     GROUP BY u.id`,
    [email]
  );
  return rows[0] ?? null;
}

export async function registerFailedAttempt(
  db: Queryable,
  userId: number,
  nextFailedCount: number,
  lockedUntil: Date | null
): Promise<void> {
  await db.query(
    `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
    [nextFailedCount, lockedUntil, userId]
  );
}

export async function registerSuccessfulLogin(db: Queryable, userId: number): Promise<void> {
  await db.query(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
    [userId]
  );
}
