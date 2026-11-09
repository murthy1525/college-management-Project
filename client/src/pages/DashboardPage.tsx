import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, CalendarCheck, Building2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { GradientStatCard } from "../components/GradientStatCard";
import { CardSkeleton, Skeleton } from "../components/Skeleton";

type Range = "day" | "week" | "month" | "year";

interface DashboardSummary {
  students: { total: number; active: number; inactive: number };
  departments: { total: number; active: number };
  courses: { total: number; active: number };
  staff: { total: number; active: number; byRole: { role: string; count: number }[] };
  attendanceToday: { marked: number; present: number; totalActive: number };
  recentActivity: { id: number; action: string; entity_type: string; entity_id: string; created_at: string }[];
}

interface AnalyticsData {
  registrations: { bucket: string; count: number }[];
  attendanceTrend: { bucket: string; present: number; marked: number; percentage: number | null }[];
  studentsByDepartment: { department: string; count: number }[];
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const DONUT_COLORS = ["#1d4ed8", "#e11d48", "#f59e0b", "#10b981", "#7c3aed", "#0891b2"];

function formatBucket(iso: string, range: Range) {
  const d = new Date(iso);
  if (range === "day" || range === "week") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (range === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.getFullYear().toString();
}

export function DashboardPage() {
  const [range, setRange] = useState<Range>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get<{ data: DashboardSummary }>("/dashboard/summary")).data.data,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics", range],
    queryFn: async () =>
      (await api.get<{ data: AnalyticsData }>("/dashboard/analytics", { params: { range } })).data.data,
  });

  const attendanceTodayPct =
    data && data.attendanceToday.marked > 0
      ? Math.round((data.attendanceToday.present / data.attendanceToday.marked) * 100)
      : null;

  const registrationsChart = analytics?.registrations.map((r) => ({
    label: formatBucket(r.bucket, range),
    count: r.count,
  }));
  const attendanceChart = analytics?.attendanceTrend.map((r) => ({
    label: formatBucket(r.bucket, range),
    percentage: r.percentage ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="A live view of the college — every number here is read straight from the database."
        actions={
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  range === opt.value ? "bg-blue-700 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !data ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <GradientStatCard
              label="Students"
              value={data.students.total}
              sub={`${data.students.active} active · ${data.students.inactive} inactive`}
              icon={<GraduationCap className="h-4.5 w-4.5" />}
              tone="blue"
            />
            <GradientStatCard
              label="Teaching Staff"
              value={data.staff.total}
              sub={`${data.staff.active} active logins`}
              icon={<Users className="h-4.5 w-4.5" />}
              tone="emerald"
            />
            <GradientStatCard
              label="Attendance Today"
              value={attendanceTodayPct === null ? "—" : `${attendanceTodayPct}%`}
              sub={
                data.attendanceToday.marked === 0
                  ? "Not marked yet today"
                  : `${data.attendanceToday.present}/${data.attendanceToday.marked} present`
              }
              icon={<CalendarCheck className="h-4.5 w-4.5" />}
              tone="amber"
            />
            <GradientStatCard
              label="Departments & Courses"
              value={data.departments.total}
              sub={`${data.courses.total} active courses`}
              icon={<Building2 className="h-4.5 w-4.5" />}
              tone="violet"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            New Registrations <span className="text-gray-400 font-normal">({range})</span>
          </h2>
          {analyticsLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={registrationsChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="count" name="Students registered" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Students by Department</h2>
          {isLoading || !analytics ? (
            <Skeleton className="h-56" />
          ) : analytics.studentsByDepartment.every((d) => d.count === 0) ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">No students yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.studentsByDepartment}
                  dataKey="count"
                  nameKey="department"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {analytics.studentsByDepartment.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Attendance % Trend <span className="text-gray-400 font-normal">({range})</span>
        </h2>
        {analyticsLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="percentage" name="Present %" stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Activity</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {isLoading && (
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {!isLoading && data?.recentActivity.length === 0 && (
          <div className="p-4 text-sm text-gray-400">No activity yet.</div>
        )}
        {data?.recentActivity.map((entry) => (
          <div key={entry.id} className="p-3 text-sm flex justify-between">
            <span className="text-gray-700">
              <span className="font-medium">{entry.action}</span> on {entry.entity_type} #{entry.entity_id}
            </span>
            <span className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
