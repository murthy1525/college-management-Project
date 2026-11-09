export interface Course {
  id: number;
  public_id: string;
  name: string;
  duration_years: number;
  is_active: boolean;
  department_id: number;
  department_name?: string;
}
