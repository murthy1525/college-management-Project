export const STAFF_ROLE_CODES = ["admin", "hod", "lecturer", "principal"] as const;
export type StaffRoleCode = (typeof STAFF_ROLE_CODES)[number];

export interface StaffUser {
  id: number;
  public_id: string;
  email: string;
  full_name: string | null;
  status: "active" | "locked" | "disabled";
  roles: string[];
}
