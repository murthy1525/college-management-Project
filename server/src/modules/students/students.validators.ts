import { z } from "zod";

export const createStudentSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1).max(80),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v) < new Date(), {
    message: "dob must be a valid past date",
  }),
  gender: z.string().min(1).max(20),
  bloodGroup: z.string().max(10).optional(),
  mobile: z.string().min(6).max(20),
  email: z.string().email().optional(),
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  nationality: z.string().max(80).optional(),
  departmentId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  currentYearOfStudy: z.number().int().min(1).max(10).default(1),
  admissionNumber: z.string().min(1).max(40),
  previousInstitution: z.string().max(200).optional(),
  previousQualification: z.string().max(150).optional(),
});

export const updateStudentSchema = createStudentSchema.partial().omit({ admissionNumber: true });

export const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const documentStatusSchema = z.object({
  isActive: z.boolean(),
});

export const uploadDocumentSchema = z.object({
  docType: z.string().trim().min(1, "docType is required"),
});

export const createLoginSchema = z.object({
  password: z.string().min(8).max(100),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
