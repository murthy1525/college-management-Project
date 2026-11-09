export type AttendanceStatus = "present" | "absent" | "late" | "leave";

export interface RosterEntry {
  student_id: number;
  public_id: string;
  first_name: string;
  last_name: string;
  department_name: string;
  course_name: string;
  status: AttendanceStatus | null;
}

export interface AttendanceRecord {
  id: number;
  attendance_date: string;
  status: AttendanceStatus;
  marked_at: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number | null;
}

export interface TrendPoint {
  bucket: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  marked: number;
  percentage: number | null;
}
