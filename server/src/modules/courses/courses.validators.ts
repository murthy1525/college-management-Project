import { z } from "zod";

export const createCourseSchema = z.object({
  name: z.string().min(2).max(150),
  departmentId: z.number().int().positive(),
  durationYears: z.number().int().min(1).max(10).default(3),
});

export const statusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
