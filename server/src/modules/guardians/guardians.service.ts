import argon2 from "argon2";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import { nextPublicId } from "../../utils/idGenerator";
import * as studentsRepository from "../students/students.repository";
import * as guardiansRepository from "./guardians.repository";
import { Guardian } from "./guardians.types";
import { CreateGuardianInput } from "./guardians.validators";

export async function listGuardians(studentId: string): Promise<Guardian[]> {
  return guardiansRepository.findByStudent(pool, studentId);
}

export async function createGuardian(
  actingUserId: number,
  studentId: string,
  input: CreateGuardianInput
): Promise<Guardian> {
  const student = await studentsRepository.findRawById(pool, studentId);
  if (!student) throw new ApiError(404, "NOT_FOUND", "Student not found");

  return withTransaction(async (client) => {
    let parentUserId: number | undefined;

    if (input.createLogin) {
      const { rows: existing } = await client.query("SELECT id FROM users WHERE email = $1", [input.email]);
      if (existing.length > 0) {
        throw new ApiError(409, "EMAIL_IN_USE", "A login with this email already exists");
      }

      const { rows: roleRows } = await client.query("SELECT id FROM roles WHERE code = 'parent'");
      if (roleRows.length === 0) {
        throw new ApiError(500, "ROLE_MISSING", "The 'parent' role is not configured");
      }

      const publicId = await nextPublicId(client, "parent", "PAR");
      const passwordHash = await argon2.hash(input.password!, { type: argon2.argon2id });

      const { rows: userRows } = await client.query(
        `INSERT INTO users (public_id, email, full_name, password_hash, status) VALUES ($1,$2,$3,$4,'active') RETURNING id`,
        [publicId, input.email, input.name, passwordHash]
      );
      parentUserId = userRows[0].id;

      await client.query("INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)", [
        parentUserId,
        roleRows[0].id,
      ]);
    }

    const guardian = await guardiansRepository.insert(client, {
      studentId,
      relationship: input.relationship,
      name: input.name,
      contactNumber: input.contactNumber,
      email: input.email,
      userId: parentUserId,
    });

    await recordAudit(client, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "guardian",
      entityId: String(guardian.id),
      after: guardian,
    });

    return guardian;
  });
}
