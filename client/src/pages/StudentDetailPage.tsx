import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage, getToken } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressCardStatusBadge } from "../components/ProgressCardStatusBadge";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";

interface StudentProfile {
  id: number;
  public_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  mobile: string;
  is_active: boolean;
  department_name: string;
  course_name: string;
  current_year_of_study: number;
  documents: StudentDocument[];
  guardians: Guardian[];
  history: { id: number; event_type: string; year_of_study: number; effective_date: string; department_name: string; course_name: string }[];
}

interface StudentDocument {
  id: number;
  doc_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  is_active: boolean;
  uploaded_at: string;
}

interface Guardian {
  id: number;
  relationship: string;
  name: string;
  contact_number: string | null;
  email: string | null;
  has_login: boolean;
}

interface ProgressCard {
  id: number;
  term: string;
  remarks: string | null;
  status: "awaiting_signatures" | "fully_signed";
  teacher_signed_at: string | null;
  teacher_signed_by_email?: string;
  parent_signed_at: string | null;
  parent_signed_by_email?: string;
}

interface AttendanceData {
  records: { id: number; attendance_date: string; status: "present" | "absent" | "late" | "leave" }[];
  summary: { present: number; absent: number; late: number; leave: number; percentage: number | null };
}

const ATTENDANCE_DOT: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-amber-500",
  leave: "bg-blue-500",
};

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-40 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export function StudentDetailPage() {
  const { studentId } = useParams();
  const { hasRole } = useAuth();
  const isStaff = hasRole("admin", "hod", "lecturer", "principal");
  // Viewing is open to any staff role, but writes (status, uploads, guardians)
  // are only ever accepted by the backend from admin/hod — match that here so
  // a lecturer never sees a button that will just 403.
  const canManageStudent = hasRole("admin", "hod");
  const canManageCards = hasRole("admin", "hod", "lecturer");
  const isParentViewer = hasRole("parent");

  const queryClient = useQueryClient();
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [guardianForm, setGuardianForm] = useState({
    relationship: "",
    name: "",
    contactNumber: "",
    email: "",
    createLogin: false,
    password: "",
  });
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [showGuardianForm, setShowGuardianForm] = useState(false);

  const [cardForm, setCardForm] = useState({ term: "", remarks: "" });
  const [cardError, setCardError] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => (await api.get<{ data: StudentProfile }>(`/students/${studentId}`)).data.data,
  });

  const { data: progressCards, isLoading: cardsLoading } = useQuery({
    queryKey: ["progress-cards", studentId],
    queryFn: async () => (await api.get<{ data: ProgressCard[] }>(`/students/${studentId}/progress-cards`)).data.data,
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () =>
      (await api.get<{ data: AttendanceData }>(`/students/${studentId}/attendance`)).data.data,
  });

  const invalidateStudent = () => queryClient.invalidateQueries({ queryKey: ["student", studentId] });
  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: ["progress-cards", studentId] });

  const statusMutation = useMutation({
    mutationFn: async (isActive: boolean) => (await api.patch(`/students/${studentId}/status`, { isActive })).data.data,
    onSuccess: () => {
      invalidateStudent();
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("file", file!);
      return (await api.post(`/students/${studentId}/documents`, formData)).data.data;
    },
    onSuccess: () => {
      setDocType("");
      setFile(null);
      setUploadError(null);
      invalidateStudent();
    },
    onError: (err) => setUploadError(extractErrorMessage(err)),
  });

  const docStatusMutation = useMutation({
    mutationFn: async ({ docId, isActive }: { docId: number; isActive: boolean }) =>
      (await api.patch(`/students/${studentId}/documents/${docId}/status`, { isActive })).data.data,
    onSuccess: invalidateStudent,
  });

  const guardianMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/students/${studentId}/guardians`, {
          relationship: guardianForm.relationship,
          name: guardianForm.name,
          contactNumber: guardianForm.contactNumber || undefined,
          email: guardianForm.email || undefined,
          createLogin: guardianForm.createLogin,
          password: guardianForm.createLogin ? guardianForm.password : undefined,
        })
      ).data.data,
    onSuccess: () => {
      setGuardianForm({ relationship: "", name: "", contactNumber: "", email: "", createLogin: false, password: "" });
      setGuardianError(null);
      setShowGuardianForm(false);
      invalidateStudent();
    },
    onError: (err) => setGuardianError(extractErrorMessage(err)),
  });

  const createCardMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/students/${studentId}/progress-cards`, {
          term: cardForm.term,
          remarks: cardForm.remarks || undefined,
        })
      ).data.data,
    onSuccess: () => {
      setCardForm({ term: "", remarks: "" });
      setCardError(null);
      setShowCardForm(false);
      invalidateCards();
    },
    onError: (err) => setCardError(extractErrorMessage(err)),
  });

  const signTeacherMutation = useMutation({
    mutationFn: async (cardId: number) =>
      (await api.patch(`/students/${studentId}/progress-cards/${cardId}/sign-teacher`)).data.data,
    onSuccess: invalidateCards,
  });

  const signParentMutation = useMutation({
    mutationFn: async (cardId: number) =>
      (await api.patch(`/students/${studentId}/progress-cards/${cardId}/sign-parent`)).data.data,
    onSuccess: invalidateCards,
  });

  function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !docType.trim()) {
      setUploadError("Choose a document type and a file");
      return;
    }
    uploadMutation.mutate();
  }

  function handleAddGuardian(e: FormEvent) {
    e.preventDefault();
    setGuardianError(null);
    if (!guardianForm.relationship.trim() || !guardianForm.name.trim()) {
      setGuardianError("Relationship and name are required");
      return;
    }
    guardianMutation.mutate();
  }

  function handleCreateCard(e: FormEvent) {
    e.preventDefault();
    setCardError(null);
    if (!cardForm.term.trim()) {
      setCardError("Term is required");
      return;
    }
    createCardMutation.mutate();
  }

  // The file route requires a bearer token; a plain <a> navigation can't set
  // a header, so the file is fetched as a blob and opened from that instead.
  async function openDocument(docId: number) {
    const token = getToken();
    const res = await fetch(`/api/students/${studentId}/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      alert("Could not load document");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  if (isLoading || !student) return <ProfileSkeleton />;

  return (
    <div>
      {isStaff && (
        <Link to="/students" className="text-sm text-blue-700 hover:underline">
          &larr; Back to students
        </Link>
      )}
      {isParentViewer && (
        <Link to="/" className="text-sm text-blue-700 hover:underline">
          &larr; My children
        </Link>
      )}

      <div className="mt-3">
        <PageHeader
          title={`${student.first_name} ${student.last_name}`}
          subtitle={`${student.public_id} · ${student.admission_number}`}
          actions={
            <>
              <StatusBadge isActive={student.is_active} />
              {canManageStudent && (
                <Button
                  variant={student.is_active ? "secondary" : "primary"}
                  isLoading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(!student.is_active)}
                >
                  {student.is_active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Overview</h2>
          <dl className="text-sm grid grid-cols-2 gap-y-2">
            <dt className="text-gray-500">Department</dt>
            <dd>{student.department_name}</dd>
            <dt className="text-gray-500">Course</dt>
            <dd>{student.course_name}</dd>
            <dt className="text-gray-500">Year of study</dt>
            <dd>{student.current_year_of_study}</dd>
            <dt className="text-gray-500">Gender</dt>
            <dd>{student.gender}</dd>
            <dt className="text-gray-500">Date of birth</dt>
            <dd>{new Date(student.dob).toLocaleDateString()}</dd>
            <dt className="text-gray-500">Mobile</dt>
            <dd>{student.mobile}</dd>
          </dl>
        </section>

        <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Academic History</h2>
          {student.history.length === 0 && <div className="text-sm text-gray-400">No history yet.</div>}
          <ul className="text-sm space-y-2">
            {student.history.map((h) => (
              <li key={h.id} className="flex justify-between">
                <span>
                  <span className="font-medium">{h.event_type}</span> — {h.department_name} / {h.course_name} (Year {h.year_of_study})
                </span>
                <span className="text-gray-400">{new Date(h.effective_date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- Attendance --- */}
      <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Attendance</h2>
        {attendanceLoading && <Skeleton className="h-16" />}
        {!attendanceLoading && attendance && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="shrink-0">
              <div className="text-3xl font-semibold text-gray-900">
                {attendance.summary.percentage === null ? "—" : `${attendance.summary.percentage}%`}
              </div>
              <div className="text-xs text-gray-400">last 90 days</div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Present {attendance.summary.present}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Absent {attendance.summary.absent}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Late {attendance.summary.late}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Leave {attendance.summary.leave}
              </span>
            </div>
          </div>
        )}

        {!attendanceLoading && attendance && attendance.records.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {attendance.records
              .slice(0, 30)
              .reverse()
              .map((r) => (
                <span
                  key={r.id}
                  title={`${r.attendance_date}: ${r.status}`}
                  className={`h-3 w-3 rounded-sm ${ATTENDANCE_DOT[r.status]}`}
                />
              ))}
          </div>
        )}
        {!attendanceLoading && attendance?.records.length === 0 && (
          <div className="text-sm text-gray-400 mt-2">No attendance recorded yet.</div>
        )}
      </section>

      {/* --- Guardians --- */}
      <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Parents / Guardians</h2>
          {canManageStudent && (
            <Button variant="secondary" onClick={() => setShowGuardianForm((s) => !s)}>
              {showGuardianForm ? "Cancel" : "Add Guardian"}
            </Button>
          )}
        </div>

        {showGuardianForm && (
          <form onSubmit={handleAddGuardian} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-gray-50 p-3 rounded-md">
            <input
              placeholder="Relationship (e.g. mother)"
              value={guardianForm.relationship}
              onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Full name"
              value={guardianForm.name}
              onChange={(e) => setGuardianForm({ ...guardianForm, name: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Contact number"
              value={guardianForm.contactNumber}
              onChange={(e) => setGuardianForm({ ...guardianForm, contactNumber: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Email"
              type="email"
              value={guardianForm.email}
              onChange={(e) => setGuardianForm({ ...guardianForm, email: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
              <input
                type="checkbox"
                checked={guardianForm.createLogin}
                onChange={(e) => setGuardianForm({ ...guardianForm, createLogin: e.target.checked })}
              />
              Create a parent portal login for this guardian (requires email)
            </label>
            {guardianForm.createLogin && (
              <input
                placeholder="Set initial password (min 8 characters)"
                type="password"
                value={guardianForm.password}
                onChange={(e) => setGuardianForm({ ...guardianForm, password: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm sm:col-span-2"
              />
            )}
            <div className="sm:col-span-2 flex items-center justify-between">
              {guardianError && <span className="text-sm text-red-700">{guardianError}</span>}
              <Button type="submit" isLoading={guardianMutation.isPending} className="ml-auto">
                Save Guardian
              </Button>
            </div>
          </form>
        )}

        {student.guardians.length === 0 && <div className="text-sm text-gray-400">No guardians on file yet.</div>}
        <ul className="divide-y divide-gray-100">
          {student.guardians.map((g) => (
            <li key={g.id} className="py-2 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium">{g.name}</span>{" "}
                <span className="text-gray-400">({g.relationship})</span>
                {g.contact_number && <span className="text-gray-400 ml-2">{g.contact_number}</span>}
                {g.email && <span className="text-gray-400 ml-2">{g.email}</span>}
              </div>
              {g.has_login && (
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Portal access</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* --- Progress Cards --- */}
      <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Progress Cards</h2>
          {canManageCards && (
            <Button variant="secondary" onClick={() => setShowCardForm((s) => !s)}>
              {showCardForm ? "Cancel" : "Create Progress Card"}
            </Button>
          )}
        </div>

        {showCardForm && (
          <form onSubmit={handleCreateCard} className="grid grid-cols-1 gap-3 mb-4 bg-gray-50 p-3 rounded-md">
            <input
              placeholder="Term (e.g. Semester 1, 2026)"
              value={cardForm.term}
              onChange={(e) => setCardForm({ ...cardForm, term: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <textarea
              placeholder="Remarks (optional)"
              value={cardForm.remarks}
              onChange={(e) => setCardForm({ ...cardForm, remarks: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              rows={2}
            />
            <div className="flex items-center justify-between">
              {cardError && <span className="text-sm text-red-700">{cardError}</span>}
              <Button type="submit" isLoading={createCardMutation.isPending} className="ml-auto">
                Save
              </Button>
            </div>
          </form>
        )}

        {cardsLoading && <Skeleton className="h-20" />}
        {!cardsLoading && progressCards?.length === 0 && (
          <div className="text-sm text-gray-400">No progress cards yet.</div>
        )}

        <ul className="space-y-3">
          {progressCards?.map((card) => (
            <li
              key={card.id}
              className={`border border-gray-100 rounded-lg p-3 border-l-4 ${
                card.status === "fully_signed" ? "border-l-green-500" : "border-l-amber-400"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm text-gray-900">{card.term}</div>
                <ProgressCardStatusBadge status={card.status} />
              </div>
              {card.remarks && <p className="text-sm text-gray-600 mb-2">{card.remarks}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  className={`rounded-md px-2 py-1.5 ${
                    card.teacher_signed_at ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {card.teacher_signed_at ? (
                    <>Teacher signed · {new Date(card.teacher_signed_at).toLocaleDateString()}</>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span>Teacher signature pending</span>
                      {canManageCards && (
                        <Button
                          variant="accent"
                          isLoading={signTeacherMutation.isPending}
                          onClick={() => signTeacherMutation.mutate(card.id)}
                        >
                          Sign as Teacher
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-md px-2 py-1.5 ${
                    card.parent_signed_at ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {card.parent_signed_at ? (
                    <>Parent signed · {new Date(card.parent_signed_at).toLocaleDateString()}</>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span>Parent signature pending</span>
                      {isParentViewer && (
                        <Button
                          variant="accent"
                          isLoading={signParentMutation.isPending}
                          onClick={() => signParentMutation.mutate(card.id)}
                        >
                          Sign as Parent
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Documents --- */}
      <section className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Documents</h2>

        {canManageStudent && (
          <form onSubmit={handleUpload} className="flex flex-wrap gap-2 items-center mb-4">
            <input
              placeholder="Document type (e.g. transfer_certificate)"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            />
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button type="submit" isLoading={uploadMutation.isPending}>
              Upload
            </Button>
          </form>
        )}
        {uploadError && <div className="mb-3 text-sm text-red-700">{uploadError}</div>}

        {student.documents.length === 0 && <div className="text-sm text-gray-400">No documents uploaded yet.</div>}
        <ul className="divide-y divide-gray-100">
          {student.documents.map((doc) => (
            <li key={doc.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <button onClick={() => openDocument(doc.id)} className="text-blue-700 hover:underline">
                  {doc.original_name}
                </button>
                <span className="text-gray-400 ml-2">
                  {doc.doc_type} · {(doc.size_bytes / 1024).toFixed(0)} KB · {new Date(doc.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge isActive={doc.is_active} />
                {canManageStudent && (
                  <Button
                    variant={doc.is_active ? "secondary" : "primary"}
                    isLoading={docStatusMutation.isPending}
                    onClick={() => docStatusMutation.mutate({ docId: doc.id, isActive: !doc.is_active })}
                  >
                    {doc.is_active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
