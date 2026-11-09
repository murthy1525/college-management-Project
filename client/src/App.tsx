import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { StaffOnlyRoute } from "./auth/StaffOnlyRoute";
import { LoginPage } from "./pages/LoginPage";
import { RoleHome } from "./pages/RoleHome";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";

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
          <Route path="/students/:studentId" element={<StudentDetailPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
