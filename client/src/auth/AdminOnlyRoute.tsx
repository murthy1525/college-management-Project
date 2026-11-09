import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

/** UX guard only — the backend's own requireRole("admin") is the real gate. */
export function AdminOnlyRoute() {
  const { hasRole } = useAuth();
  if (!hasRole("admin")) return <Navigate to="/" replace />;
  return <Outlet />;
}
