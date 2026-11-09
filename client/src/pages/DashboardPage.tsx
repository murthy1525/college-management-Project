import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { CardSkeleton, Skeleton } from "../components/Skeleton";

interface DashboardSummary {
  students: { total: number; active: number; inactive: number };
  departments: { total: number; active: number };
  courses: { total: number; active: number };
  recentActivity: { id: number; action: string; entity_type: string; entity_id: string; created_at: string }[];
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get<{ data: DashboardSummary }>("/dashboard/summary")).data.data,
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="A live view of the college — every number here is read straight from the database." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {isLoading || !data ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Students" value={data.students.total} sub={`${data.students.active} active · ${data.students.inactive} inactive`} />
            <StatCard label="Departments" value={data.departments.total} sub={`${data.departments.active} active`} />
            <StatCard label="Courses" value={data.courses.total} sub={`${data.courses.active} active`} />
          </>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Activity</h2>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
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
