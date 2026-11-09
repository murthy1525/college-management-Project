import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(150),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(150),
});

export const statusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
