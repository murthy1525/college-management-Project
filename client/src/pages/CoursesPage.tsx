import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
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
  public_id: string;
  name: string;
  duration_years: number;
  is_active: boolean;
  department_id: number;
  department_name: string;
}

export function CoursesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [durationYears, setDurationYears] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments", false],
    queryFn: async () => (await api.get<{ data: Department[] }>("/departments")).data.data,
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", includeInactive],
    queryFn: async () => (await api.get<{ data: Course[] }>("/courses", { params: { includeInactive } })).data.data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/courses", {
          name: name.trim(),
          departmentId: Number(departmentId),
          durationYears,
        })
      ).data.data,
    onSuccess: () => {
      setName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await api.patch(`/courses/${id}/status`, { isActive })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!departmentId) {
      setError("Choose a department");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Courses" subtitle="Programs offered within each department." />

      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2 mb-4 items-center">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Select department</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Course name"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 max-w-xs"
          />
          <input
            type="number"
            min={1}
            max={10}
            value={durationYears}
            onChange={(e) => setDurationYears(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-20"
            title="Duration (years)"
          />
          <Button type="submit" isLoading={createMutation.isPending}>
            Add Course
          </Button>
        </form>
      )}
      {error && <div className="mb-4 text-sm text-red-700">{error}</div>}
      {canManage && !departments?.length && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          Create a department first before adding courses.
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        Show inactive courses
      </label>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <TableSkeleton columns={6} />}
            {!isLoading && courses?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No courses yet.</td>
              </tr>
            )}
            {courses?.map((course) => (
              <tr key={course.id}>
                <td className="px-4 py-2 text-gray-500">{course.public_id}</td>
                <td className="px-4 py-2 text-gray-900">{course.name}</td>
                <td className="px-4 py-2 text-gray-600">{course.department_name}</td>
                <td className="px-4 py-2 text-gray-600">{course.duration_years} yrs</td>
                <td className="px-4 py-2">
                  <StatusBadge isActive={course.is_active} />
                </td>
                <td className="px-4 py-2 text-right">
                  {canManage && (
                    <Button
                      variant={course.is_active ? "secondary" : "primary"}
                      onClick={() => statusMutation.mutate({ id: course.id, isActive: !course.is_active })}
                      isLoading={statusMutation.isPending && statusMutation.variables?.id === course.id}
                    >
                      {course.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
