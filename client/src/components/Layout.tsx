import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users,
  ShieldCheck,
  LogOut,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { PageTransition } from "./PageTransition";
import { api } from "../lib/api";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const ATTENDANCE_NAV: NavItem = { to: "/attendance", label: "Attendance", icon: CalendarCheck };

const STAFF_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/students", label: "Students", icon: Users },
];

const ADMIN_ONLY_NAV: NavItem[] = [{ to: "/staff", label: "Staff Accounts", icon: ShieldCheck }];

const LECTURER_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users },
];

const PARENT_NAV: NavItem[] = [{ to: "/", label: "My Children", icon: Users, end: true }];
const STUDENT_NAV: NavItem[] = [{ to: "/", label: "My Profile", icon: GraduationCap, end: true }];

function initials(label: string) {
  return label
    .split(/[@.\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isLecturerOnly = hasRole("lecturer") && !hasRole("admin", "hod", "principal");
  const canMarkAttendance = hasRole("admin", "hod", "lecturer");

  const navItems: NavItem[] = hasRole("parent")
    ? PARENT_NAV
    : hasRole("student")
      ? STUDENT_NAV
      : isLecturerOnly
        ? [...LECTURER_NAV, ATTENDANCE_NAV]
        : [...STAFF_NAV, ...(canMarkAttendance ? [ATTENDANCE_NAV] : []), ...(isAdmin ? ADMIN_ONLY_NAV : [])];

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get("/dashboard/summary")).data.data,
    enabled: !isLecturerOnly && !hasRole("parent", "student"),
  });

  const displayName = user?.fullName || user?.email || "";

  return (
    <div className="min-h-screen flex app-shell-bg">
      <aside className="w-64 sidebar-gradient flex flex-col text-white">
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center font-bold">C</div>
          <div>
            <div className="text-base font-semibold leading-tight">CMS</div>
            <div className="text-[11px] text-blue-100/80 leading-tight">College Management</div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const badge =
              item.to === "/students" && summary ? summary.students.total : undefined;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive ? "bg-white text-blue-800 shadow-sm" : "text-blue-50/90 hover:bg-white/10"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {badge !== undefined && (
                      <span
                        aria-hidden="true"
                        className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-blue-100 text-blue-800" : "bg-white/15 text-white"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                    {item.to === "/staff" && (
                      <span aria-hidden="true" className={`text-[11px] ${isActive ? "text-rose-600" : "text-rose-200"}`}>
                        ●
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3">
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
            <div className="h-9 w-9 rounded-full bg-rose-500 flex items-center justify-center text-sm font-semibold shrink-0">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-[11px] text-blue-100/80 capitalize truncate">{user?.roles.join(", ")}</div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="text-blue-100/80 hover:text-white transition shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
