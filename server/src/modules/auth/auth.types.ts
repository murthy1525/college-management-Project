export interface AuthUserRow {
  id: number;
  public_id: string;
  email: string;
  full_name: string | null;
  password_hash: string;
  status: "active" | "locked" | "disabled";
  failed_login_count: number;
  locked_until: string | null;
  roles: string[];
}
