import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { CardSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";

interface ChildSummary {
  id: number;
  public_id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department_name: string;
  course_name: string;
  current_year_of_study: number;
}

export function ParentHomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["me-students"],
    queryFn: async () => (await api.get<{ data: ChildSummary[] }>("/me/students")).data.data,
  });

  return (
    <div>
      <PageHeader title="My Children" subtitle="Select a child to view their profile, attendance, and progress cards." />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
          No children are linked to your account yet. Contact the school office if this looks wrong.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data?.map((child) => (
          <Link
            key={child.id}
            to={`/students/${child.id}`}
            className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">
                  {child.first_name} {child.last_name}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {child.course_name} · Year {child.current_year_of_study}
                </div>
                <div className="text-xs text-gray-400 mt-1">{child.department_name}</div>
              </div>
              <StatusBadge isActive={child.is_active} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
