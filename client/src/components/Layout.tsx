import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageTransition } from "./PageTransition";

const STAFF_NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/departments", label: "Departments" },
  { to: "/courses", label: "Courses" },
  { to: "/students", label: "Students" },
];

const PARENT_NAV = [{ to: "/", label: "My Children" }];
const STUDENT_NAV = [{ to: "/", label: "My Profile" }];

export function Layout() {
  const { user, logout, hasRole } = useAuth();

  const navItems = hasRole("parent") ? PARENT_NAV : hasRole("student") ? STUDENT_NAV : STAFF_NAV;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 text-lg font-semibold text-blue-800">
          CMS <span className="text-rose-600">•</span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition ${
                  isActive ? "bg-blue-50 text-blue-800" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="text-sm text-gray-500">
            Signed in as <span className="font-medium text-gray-900">{user?.email}</span>{" "}
            <span className="text-xs text-gray-400">({user?.roles.join(", ")})</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">
            Log out
          </button>
        </header>
        <main className="flex-1 p-6">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
