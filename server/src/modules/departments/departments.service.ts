import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../middleware/error.middleware";
import { recordAudit } from "../../utils/audit";
import * as departmentsRepository from "./departments.repository";
import { Department } from "./departments.types";
import { CreateDepartmentInput, UpdateDepartmentInput } from "./departments.validators";

export async function listDepartments(includeInactive: boolean): Promise<Department[]> {
  return departmentsRepository.findAll(pool, includeInactive);
}

export async function createDepartment(
  userId: number,
  input: CreateDepartmentInput
): Promise<Department> {
  return withTransaction(async (client) => {
    const department = await departmentsRepository.insert(client, input);
    await recordAudit(client, {
      userId,
      action: "CREATE",
      entityType: "department",
      entityId: department.public_id,
      after: department,
    });
    return department;
  });
}

export async function updateDepartment(
  userId: number,
  id: string,
  input: UpdateDepartmentInput
): Promise<Department> {
  const before = await departmentsRepository.findById(pool, id);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Department not found");

  const after = await departmentsRepository.updateName(pool, id, input.name);
  await recordAudit(pool, {
    userId,
    action: "UPDATE",
    entityType: "department",
    entityId: before.public_id,
    before,
    after,
  });
  return after!;
}

export async function setDepartmentStatus(
  userId: number,
  id: string,
  isActive: boolean
): Promise<Department> {
  const before = await departmentsRepository.findById(pool, id);
  if (!before) throw new ApiError(404, "NOT_FOUND", "Department not found");

  const after = await departmentsRepository.updateStatus(pool, id, isActive);
  await recordAudit(pool, {
    userId,
    action: "STATUS_CHANGE",
    entityType: "department",
    entityId: before.public_id,
    before,
    after,
  });
  return after!;
}
