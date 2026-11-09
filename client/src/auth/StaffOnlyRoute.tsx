import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** UX guard only — hides staff-only pages from parent/student nav paths.
 * The backend enforces the real authorization regardless of this. */
export function StaffOnlyRoute() {
  const { hasRole } = useAuth();
  if (hasRole("parent") || hasRole("student")) return <Navigate to="/" replace />;
  return <Outlet />;
}
