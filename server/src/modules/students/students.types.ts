export interface Student {
  id: number;
  user_id: number | null;
  public_id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  dob: string;
  gender: string;
  blood_group: string | null;
  mobile: string;
  email: string | null;
  photo_url: string | null;
  permanent_address: string | null;
  current_address: string | null;
  nationality: string | null;
  department_id: number;
  course_id: number;
  current_section_id: number | null;
  current_year_of_study: number;
  admission_date: string;
  previous_institution: string | null;
  previous_qualification: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentListItem {
  id: number;
  public_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  status: string;
  is_active: boolean;
  current_year_of_study: number;
  department_name: string;
  course_name: string;
}

export interface StudentListFilters {
  page: number;
  pageSize: number;
  includeInactive: boolean;
  departmentId?: string;
  courseId?: string;
  search?: string;
}

export interface StudentDocument {
  id: number;
  doc_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  verified_status: string;
  is_active: boolean;
  uploaded_at: string;
}
