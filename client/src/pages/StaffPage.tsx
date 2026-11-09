import type { FormEvent } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../lib/api";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";

interface StaffUser {
  id: number;
  public_id: string;
  email: string;
  full_name: string | null;
  status: "active" | "locked" | "disabled";
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  hod: "Head of Department",
  lecturer: "Lecturer",
  principal: "Principal",
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-blue-50 text-blue-700",
  hod: "bg-indigo-50 text-indigo-700",
  lecturer: "bg-emerald-50 text-emerald-700",
  principal: "bg-amber-50 text-amber-700",
};

const emptyForm = { fullName: "", email: "", password: "", role: "lecturer" };

export function StaffPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await api.get<{ data: StaffUser[] }>("/staff")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/staff", form)).data.data,
    onSuccess: () => {
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "active" | "disabled" }) =>
      (await api.patch(`/staff/${id}/status`, { status })).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
    onError: (err) => alert(extractErrorMessage(err)),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 8) {
      setError("Full name, email, and an 8+ character password are required");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Staff Accounts"
        subtitle="Admin, HOD, lecturer, and principal logins — each one signs in and sees only what their role allows."
        actions={
          <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Create Staff Login"}
          </Button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <input
            placeholder="Initial password (min 8 characters)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="lecturer">Lecturer</option>
            <option value="hod">Head of Department</option>
            <option value="principal">Principal</option>
            <option value="admin">Administrator</option>
          </select>

          <div className="sm:col-span-2 flex items-center justify-between">
            {error && <span className="text-sm text-red-700">{error}</span>}
            <Button type="submit" isLoading={createMutation.isPending} className="ml-auto">
              Create Login
            </Button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <TableSkeleton columns={6} />}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No staff accounts yet.</td>
              </tr>
            )}
            {data?.map((staff) => (
              <tr key={staff.id}>
                <td className="px-4 py-2 text-gray-500">{staff.public_id}</td>
                <td className="px-4 py-2 text-gray-900">{staff.full_name ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{staff.email}</td>
                <td className="px-4 py-2">
                  {staff.roles.map((r) => (
                    <span key={r} className={`mr-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[r] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      staff.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {staff.status === "active" ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant={staff.status === "active" ? "secondary" : "primary"}
                    isLoading={statusMutation.isPending && statusMutation.variables?.id === staff.id}
                    onClick={() =>
                      statusMutation.mutate({
                        id: staff.id,
                        status: staff.status === "active" ? "disabled" : "active",
                      })
                    }
                  >
                    {staff.status === "active" ? "Disable" : "Enable"}
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
