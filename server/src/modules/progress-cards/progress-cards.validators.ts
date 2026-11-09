import { z } from "zod";

export const createProgressCardSchema = z.object({
  term: z.string().min(1).max(100),
  remarks: z.string().max(2000).optional(),
});

export type CreateProgressCardInput = z.infer<typeof createProgressCardSchema>;
