import { pool } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import { AccessTokenPayload } from "../../utils/jwt";
import { assertCanAccessStudent } from "../students/students.access";
import * as guardiansRepository from "../guardians/guardians.repository";
import * as progressCardsRepository from "./progress-cards.repository";
import { ProgressCard } from "./progress-cards.types";
import { CreateProgressCardInput } from "./progress-cards.validators";

export async function listProgressCards(caller: AccessTokenPayload, studentId: string): Promise<ProgressCard[]> {
  await assertCanAccessStudent(caller, Number(studentId));
  return progressCardsRepository.findByStudent(pool, studentId);
}

export async function createProgressCard(
  userId: number,
  studentId: string,
  input: CreateProgressCardInput
): Promise<ProgressCard> {
  const card = await progressCardsRepository.insert(pool, { studentId, ...input, createdBy: userId });
  await recordAudit(pool, {
    userId,
    action: "CREATE",
    entityType: "progress_card",
    entityId: String(card.id),
    after: card,
  });
  return card;
}

export async function signAsTeacher(userId: number, studentId: string, cardId: string): Promise<ProgressCard> {
  const before = await progressCardsRepository.findOne(pool, studentId, cardId);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Progress card not found");
  if (before.teacher_signed_at) {
    throw new ApiError(409, "ALREADY_SIGNED", "This progress card already has a teacher signature");
  }

  const after = await progressCardsRepository.signAsTeacher(pool, cardId, userId);
  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "progress_card",
    entityId: String(before.id),
    before,
    after,
  });
  return after!;
}

export async function signAsParent(
  caller: AccessTokenPayload,
  studentId: string,
  cardId: string
): Promise<ProgressCard> {
  const childIds = await guardiansRepository.findChildStudentIdsByUserId(pool, caller.userId);
  if (!childIds.includes(Number(studentId))) {
    throw new ApiError(403, "FORBIDDEN", "You are not a registered parent/guardian for this student");
  }

  const before = await progressCardsRepository.findOne(pool, studentId, cardId);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Progress card not found");
  if (before.parent_signed_at) {
    throw new ApiError(409, "ALREADY_SIGNED", "This progress card already has a parent signature");
  }

  const after = await progressCardsRepository.signAsParent(pool, cardId, caller.userId);
  await recordAudit(pool, {
    userId: caller.userId,
    action: "STATUS_CHANGE",
    entityType: "progress_card",
    entityId: String(before.id),
    before,
    after,
  });
  return after!;
}
