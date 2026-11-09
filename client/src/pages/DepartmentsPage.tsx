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
  public_id: string;
  name: string;
  is_active: boolean;
}

export function DepartmentsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["departments", includeInactive],
    queryFn: async () =>
      (await api.get<{ data: Department[] }>("/departments", { params: { includeInactive } })).data.data,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => (await api.post("/departments", { name })).data.data,
    onSuccess: () => {
      setName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await api.patch(`/departments/${id}/status`, { isActive })).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    createMutation.mutate(name.trim());
  }

  return (
    <div>
      <PageHeader title="Departments" subtitle="Academic departments offered by the college." />

      {canManage && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New department name"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <Button type="submit" isLoading={createMutation.isPending}>
            Add Department
          </Button>
        </form>
      )}
      {error && <div className="mb-4 text-sm text-red-700">{error}</div>}

      <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        Show inactive departments
      </label>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <TableSkeleton columns={4} />}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No departments yet. Add one above.</td>
              </tr>
            )}
            {data?.map((dept) => (
              <tr key={dept.id}>
                <td className="px-4 py-2 text-gray-500">{dept.public_id}</td>
                <td className="px-4 py-2 text-gray-900">{dept.name}</td>
                <td className="px-4 py-2">
                  <StatusBadge isActive={dept.is_active} />
                </td>
                <td className="px-4 py-2 text-right">
                  {canManage && (
                    <Button
                      variant={dept.is_active ? "secondary" : "primary"}
                      onClick={() => statusMutation.mutate({ id: dept.id, isActive: !dept.is_active })}
                      isLoading={statusMutation.isPending && statusMutation.variables?.id === dept.id}
                    >
                      {dept.is_active ? "Deactivate" : "Activate"}
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
