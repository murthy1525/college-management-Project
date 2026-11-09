import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { StaffOnlyRoute } from "./auth/StaffOnlyRoute";
import { AdminOnlyRoute } from "./auth/AdminOnlyRoute";
import { AttendanceOnlyRoute } from "./auth/AttendanceOnlyRoute";
import { LoginPage } from "./pages/LoginPage";
import { RoleHome } from "./pages/RoleHome";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { StaffPage } from "./pages/StaffPage";
import { AttendancePage } from "./pages/AttendancePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<RoleHome />} />
          <Route element={<StaffOnlyRoute />}>
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/students" element={<StudentsPage />} />
          </Route>
          <Route element={<AdminOnlyRoute />}>
            <Route path="/staff" element={<StaffPage />} />
          </Route>
          <Route element={<AttendanceOnlyRoute />}>
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
