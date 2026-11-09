import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** UX guard only — the backend's own requireRole("admin","hod","lecturer") on
 * /api/attendance/* is the real gate. Principal and other roles land back home. */
export function AttendanceOnlyRoute() {
  const { hasRole } = useAuth();
  if (!hasRole("admin", "hod", "lecturer")) return <Navigate to="/" replace />;
  return <Outlet />;
}
