import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch rejected promises thrown inside async handlers —
 * an unhandled rejection in an async route crashes the whole process (Node's
 * default unhandledRejection behavior). Every async route must be wrapped so
 * a thrown ApiError (or any error) reaches the error middleware via next()
 * instead of taking the server down.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
