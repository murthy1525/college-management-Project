export interface Guardian {
  id: number;
  student_id: number;
  relationship: string;
  name: string;
  contact_number: string | null;
  email: string | null;
  user_id: number | null;
  has_login: boolean;
}
