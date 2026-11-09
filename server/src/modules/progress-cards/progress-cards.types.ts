export interface ProgressCard {
  id: number;
  student_id: number;
  term: string;
  remarks: string | null;
  status: "awaiting_signatures" | "fully_signed";
  created_by: number;
  teacher_signed_by: number | null;
  teacher_signed_by_email?: string;
  teacher_signed_at: string | null;
  parent_signed_by: number | null;
  parent_signed_by_email?: string;
  parent_signed_at: string | null;
  created_at: string;
  updated_at: string;
}
