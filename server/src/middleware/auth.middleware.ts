import { NextFunction, Request, Response } from "express";
import { ApiError } from "./error.middleware";
import { AccessTokenPayload, verifyAccessToken } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHENTICATED", "Missing bearer token");
  }
  try {
    const token = header.slice("Bearer ".length);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token");
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = req.user?.roles ?? [];
    if (!roles.some((r) => allowedRoles.includes(r))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this resource");
    }
    next();
  };
}
