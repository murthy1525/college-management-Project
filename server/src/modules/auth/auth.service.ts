import argon2 from "argon2";
import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { signAccessToken } from "../../utils/jwt";
import * as authRepository from "./auth.repository";
import { LoginInput } from "./auth.validators";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LoginResult {
  accessToken: string;
  user: { id: number; publicId: string; email: string; roles: string[] };
}

// Same generic error whether the email doesn't exist or the password is
// wrong — never reveal to the caller which one it was.
function invalidCredentials(): ApiError {
  return new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await authRepository.findByEmailWithRoles(pool, input.email);
  if (!user) throw invalidCredentials();

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

  const passwordOk = await argon2.verify(user.password_hash, input.password);
  if (!passwordOk) {
    const nextCount = user.failed_login_count + 1;
    const lockUntil =
      nextCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;

    await authRepository.registerFailedAttempt(pool, user.id, lockUntil ? 0 : nextCount, lockUntil);

    if (lockUntil) {
      throw new ApiError(423, "ACCOUNT_LOCKED", `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    throw invalidCredentials();
  }

  await authRepository.registerSuccessfulLogin(pool, user.id);

  const accessToken = signAccessToken({
    userId: user.id,
    publicId: user.public_id,
    email: user.email,
    roles: user.roles,
  });

  return {
    accessToken,
    user: { id: user.id, publicId: user.public_id, email: user.email, roles: user.roles },
  };
}
