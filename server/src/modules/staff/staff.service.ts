import argon2 from "argon2";
import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import { nextPublicId } from "../../utils/idGenerator";
import * as staffRepository from "./staff.repository";
import { StaffRoleCode, StaffUser } from "./staff.types";
import { CreateStaffInput } from "./staff.validators";

const ROLE_PREFIX: Record<StaffRoleCode, string> = {
  admin: "ADM",
  hod: "HOD",
  lecturer: "LEC",
  principal: "PRI",
};

export async function listStaff(): Promise<StaffUser[]> {
  return staffRepository.findAll(pool);
}

export async function createStaff(actingUserId: number, input: CreateStaffInput): Promise<StaffUser> {
  const existing = await staffRepository.findByEmail(pool, input.email);
  if (existing) throw new ApiError(409, "EMAIL_IN_USE", "A login with this email already exists");

  const roleId = await staffRepository.findRoleId(pool, input.role);
  if (!roleId) throw new ApiError(500, "ROLE_MISSING", `The '${input.role}' role is not configured`);

  const created = await withTransaction(async (client) => {
    const publicId = await nextPublicId(client, `staff_${input.role}`, ROLE_PREFIX[input.role]);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const userId = await staffRepository.insertUser(client, {
      publicId,
      email: input.email,
      fullName: input.fullName,
      passwordHash,
    });
    await staffRepository.assignRole(client, userId, roleId);

    await recordAudit(client, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "staff_login",
      entityId: publicId,
      after: { email: input.email, fullName: input.fullName, role: input.role },
    });

    return staffRepository.findOne(client, String(userId));
  });

  return created!;
}

export async function setStaffStatus(
  actingUserId: number,
  userId: string,
  status: "active" | "disabled"
): Promise<StaffUser> {
  if (Number(userId) === actingUserId && status === "disabled") {
    throw new ApiError(422, "CANNOT_DISABLE_SELF", "You cannot disable your own account");
  }

  const before = await staffRepository.findOne(pool, userId);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Staff account not found");

  await staffRepository.updateStatus(pool, userId, status);
  const after = await staffRepository.findOne(pool, userId);

  await recordAudit(pool, {
    userId: actingUserId,
    action: "STATUS_CHANGE",
    entityType: "staff_login",
    entityId: before.public_id,
    before,
    after,
  });

  return after!;
}
