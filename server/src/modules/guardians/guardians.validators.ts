import { z } from "zod";

export const createGuardianSchema = z
  .object({
    relationship: z.string().min(1).max(40),
    name: z.string().min(1).max(150),
    contactNumber: z.string().max(20).optional(),
    email: z.string().email().optional(),
    createLogin: z.boolean().default(false),
    password: z.string().min(8).max(100).optional(),
  })
  .refine((v) => !v.createLogin || !!v.email, {
    message: "email is required to create a parent login",
    path: ["email"],
  })
  .refine((v) => !v.createLogin || !!v.password, {
    message: "password is required to create a parent login",
    path: ["password"],
  });

export type CreateGuardianInput = z.infer<typeof createGuardianSchema>;
