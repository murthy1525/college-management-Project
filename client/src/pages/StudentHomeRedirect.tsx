import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { FullPageSpinner } from "../components/Spinner";

interface OwnStudent {
  id: number;
}

/** A student's "dashboard" is just their own profile — there's nothing else
 * for them to land on, so skip straight there. */
export function StudentHomeRedirect() {
  const { data, isLoading } = useQuery({
    queryKey: ["me-students"],
    queryFn: async () => (await api.get<{ data: OwnStudent[] }>("/me/students")).data.data,
  });

  if (isLoading) return <FullPageSpinner />;

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
        Your account isn't linked to a student record yet. Contact the school office.
      </div>
    );
  }

  return <Navigate to={`/students/${data[0].id}`} replace />;
}
