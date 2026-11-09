import { useAuth } from "../auth/AuthContext";
import { DashboardPage } from "./DashboardPage";
import { ParentHomePage } from "./ParentHomePage";
import { StudentHomeRedirect } from "./StudentHomeRedirect";

/** Routes "/" to the right landing experience per role: staff get the
 * stats dashboard, a parent gets their children list, a student goes
 * straight to their own profile. */
export function RoleHome() {
  const { hasRole } = useAuth();

  if (hasRole("parent")) return <ParentHomePage />;
  if (hasRole("student")) return <StudentHomeRedirect />;
  return <DashboardPage />;
}
