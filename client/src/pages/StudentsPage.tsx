import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../lib/api";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";

interface Department {
  id: number;
  name: string;
}
interface Course {
  id: number;
  name: string;
  department_id: number;
}
interface StudentListItem {
  id: number;
  public_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  current_year_of_study: number;
  department_name: string;
  course_name: string;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  dob: "",
  gender: "",
  mobile: "",
  admissionNumber: "",
  departmentId: "",
  courseId: "",
};

export function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments", false],
    queryFn: async () => (await api.get<{ data: Department[] }>("/departments")).data.data,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses", false],
    queryFn: async () => (await api.get<{ data: Course[] }>("/courses")).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, includeInactive],
    queryFn: async () =>
      (
        await api.get<{ data: StudentListItem[] }>("/students", {
          params: { search: search || undefined, includeInactive },
        })
      ).data.data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/students", {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dob: form.dob,
          gender: form.gender,
          mobile: form.mobile.trim(),
          admissionNumber: form.admissionNumber.trim(),
          departmentId: Number(form.departmentId),
          courseId: Number(form.courseId),
        })
      ).data.data,
    onSuccess: () => {
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await api.patch(`/students/${id}/status`, { isActive })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const coursesForDepartment = courses?.filter((c) => String(c.department_id) === form.departmentId);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Search, register, and manage student records."
        actions={
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Register Student"}
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            placeholder="First name"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Last name"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <input
            type="date"
            required
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <select
            required
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input
            placeholder="Mobile number"
            required
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Admission number"
            required
            value={form.admissionNumber}
            onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <select
            required
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value, courseId: "" })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Department</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            required
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            disabled={!form.departmentId}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Course</option>
            {coursesForDepartment?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="sm:col-span-3 flex items-center justify-between">
            {error && <span className="text-sm text-red-700">{error}</span>}
            <Button type="submit" isLoading={createMutation.isPending} className="ml-auto">
              Save Student
            </Button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-4 mb-3">
        <input
          placeholder="Search by name, STU id, or admission number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <TableSkeleton columns={6} />}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No students found.</td>
              </tr>
            )}
            {data?.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-2 text-gray-500">{student.public_id}</td>
                <td className="px-4 py-2 text-gray-900">
                  <Link to={`/students/${student.id}`} className="text-blue-700 hover:underline">
                    {student.first_name} {student.last_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{student.department_name}</td>
                <td className="px-4 py-2 text-gray-600">{student.course_name}</td>
                <td className="px-4 py-2">
                  <StatusBadge isActive={student.is_active} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant={student.is_active ? "secondary" : "primary"}
                    onClick={() => statusMutation.mutate({ id: student.id, isActive: !student.is_active })}
                    isLoading={statusMutation.isPending && statusMutation.variables?.id === student.id}
                  >
                    {student.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
