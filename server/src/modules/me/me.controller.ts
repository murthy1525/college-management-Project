import { Request, Response } from "express";
import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import * as studentsRepository from "../students/students.repository";
import * as guardiansRepository from "../guardians/guardians.repository";

/** What a signed-in parent or student should land on: for a parent, the
 * children linked to their guardian records; for a student, their own
 * record. Lets the frontend decide where "home" is without staff-only
 * endpoints leaking into a non-staff role's navigation. */
export async function myStudents(req: Request, res: Response) {
  const user = req.user!;

  if (user.roles.includes("parent")) {
    const childIds = await guardiansRepository.findChildStudentIdsByUserId(pool, user.userId);
    const data = await studentsRepository.findBasicByIds(pool, childIds);
    return res.json({ success: true, data });
  }

  if (user.roles.includes("student")) {
    const own = await studentsRepository.findByUserId(pool, user.userId);
    if (!own) return res.json({ success: true, data: [] });
    const data = await studentsRepository.findBasicByIds(pool, [own.id]);
    return res.json({ success: true, data });
  }

  throw new ApiError(403, "FORBIDDEN", "This endpoint is only for parent or student logins");
}
