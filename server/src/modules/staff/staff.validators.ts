import { z } from "zod";
import { STAFF_ROLE_CODES } from "./staff.types";

export const createStaffSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(STAFF_ROLE_CODES),
});

export const staffStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
