import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const markAttendanceSchema = z.object({
  date: isoDate.refine((v) => new Date(v) <= new Date(new Date().toISOString().slice(0, 10)), {
    message: "Cannot mark attendance for a future date",
  }),
  records: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(["present", "absent", "late", "leave"]),
      })
    )
    .min(1, "At least one record is required"),
});

export const rangeSchema = z.enum(["day", "week", "month", "year"]);

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
