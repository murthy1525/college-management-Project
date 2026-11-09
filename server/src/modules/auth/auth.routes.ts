import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { signAccessToken } from "../../utils/jwt";
import { asyncHandler } from "../../utils/asyncHandler";

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid credentials payload", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const { rows } = await pool.query(
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

    // Same generic error whether the email doesn't exist or the password is
    // wrong — never reveal which one it was.
    const genericError = () =>
      new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

    if (rows.length === 0) {
      throw genericError();
    }

    const user = rows[0];

    if (user.status !== "active") {
      throw new ApiError(403, "ACCOUNT_DISABLED", "This account is not active");
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ApiError(
        423,
        "ACCOUNT_LOCKED",
        `Too many failed attempts. Try again after ${new Date(user.locked_until).toLocaleTimeString()}`
      );
    }

    const passwordOk = await argon2.verify(user.password_hash, password);
    if (!passwordOk) {
      const nextCount = user.failed_login_count + 1;
      const lockUntil =
        nextCount >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null;

      await pool.query(
        `UPDATE users SET failed_login_count = $1,
                          locked_until = $2
         WHERE id = $3`,
        [lockUntil ? 0 : nextCount, lockUntil, user.id]
      );

      if (lockUntil) {
        throw new ApiError(
          423,
          "ACCOUNT_LOCKED",
          `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
        );
      }
      throw genericError();
    }

    await pool.query(
      "UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1",
      [user.id]
    );

    const accessToken = signAccessToken({
      userId: user.id,
      publicId: user.public_id,
      email: user.email,
      roles: user.roles,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          publicId: user.public_id,
          email: user.email,
          roles: user.roles,
        },
      },
    });
  })
);

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: req.user });
});
