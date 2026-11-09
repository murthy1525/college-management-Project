import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../lib/api";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";

type Status = "present" | "absent" | "late" | "leave";

interface Department {
  id: number;
  name: string;
}
interface Course {
  id: number;
  name: string;
  department_id: number;
}
interface RosterEntry {
  student_id: number;
  public_id: string;
  first_name: string;
  last_name: string;
  department_name: string;
  course_name: string;
  status: Status | null;
}

const STATUS_OPTIONS: { value: Status; label: string; activeClass: string }[] = [
  { value: "present", label: "Present", activeClass: "bg-green-600 text-white border-green-600" },
  { value: "absent", label: "Absent", activeClass: "bg-red-600 text-white border-red-600" },
  { value: "late", label: "Late", activeClass: "bg-amber-500 text-white border-amber-500" },
  { value: "leave", label: "Leave", activeClass: "bg-blue-600 text-white border-blue-600" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [draft, setDraft] = useState<Record<number, Status>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments", false],
    queryFn: async () => (await api.get<{ data: Department[] }>("/departments")).data.data,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses", false],
    queryFn: async () => (await api.get<{ data: Course[] }>("/courses")).data.data,
  });
  const coursesForDepartment = courses?.filter((c) => !departmentId || String(c.department_id) === departmentId);

  const { data: roster, isLoading } = useQuery({
    queryKey: ["attendance-roster", date, departmentId, courseId],
    queryFn: async () =>
      (
        await api.get<{ data: RosterEntry[] }>("/attendance/roster", {
          params: { date, departmentId: departmentId || undefined, courseId: courseId || undefined },
        })
      ).data.data,
  });

  useEffect(() => {
    if (!roster) return;
    const next: Record<number, Status> = {};
    for (const entry of roster) next[entry.student_id] = entry.status ?? "present";
    setDraft(next);
    setSaveMessage(null);
  }, [roster]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = Object.entries(draft).map(([studentId, status]) => ({
        studentId: Number(studentId),
        status,
      }));
      return (await api.post("/attendance/mark", { date, records })).data.data;
    },
    onSuccess: (data) => {
      setSaveMessage(`Saved attendance for ${data.marked} student(s).`);
      queryClient.invalidateQueries({ queryKey: ["attendance-roster"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
    },
    onError: (err) => setSaveMessage(extractErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance for a class — present, absent, late, or on approved leave."
        actions={
          <Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={!roster?.length}>
            Save Attendance
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setCourseId("");
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All courses</option>
          {coursesForDepartment?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {roster && roster.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              const next: Record<number, Status> = {};
              for (const entry of roster) next[entry.student_id] = "present";
              setDraft(next);
            }}
          >
            Mark all present
          </Button>
        )}
      </div>

      {saveMessage && <div className="mb-4 text-sm text-gray-600">{saveMessage}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <TableSkeleton columns={5} />}
            {!isLoading && roster?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No active students match these filters.
                </td>
              </tr>
            )}
            {roster?.map((entry) => (
              <tr key={entry.student_id}>
                <td className="px-4 py-2 text-gray-500">{entry.public_id}</td>
                <td className="px-4 py-2 text-gray-900">
                  {entry.first_name} {entry.last_name}
                </td>
                <td className="px-4 py-2 text-gray-600">{entry.department_name}</td>
                <td className="px-4 py-2 text-gray-600">{entry.course_name}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDraft({ ...draft, [entry.student_id]: opt.value })}
                        className={`px-2 py-1 rounded-md text-xs font-medium border transition ${
                          draft[entry.student_id] === opt.value
                            ? opt.activeClass
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
