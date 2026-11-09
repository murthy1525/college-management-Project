# Roadmap, Testing Strategy & Open Questions

## 1. Phased Delivery (with dependencies)

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Architecture & docs (this set) | — |
| 2 | Project scaffolding: Vite+TS client, Express+TS server, SQL Server connection, ESLint/Prettier, env config, CI skeleton | 1 |
| 3 | Auth + RBAC: login/refresh/logout, `users/roles/permissions` schema + migrations, auth middleware, role-aware route guards | 2 |
| 4 | Master data: departments/courses/academic-years/semesters/sections/subjects + admin CRUD UI | 3 |
| 5 | Student & Lecturer management: registration, profile tabs, document upload, unique-ID generation, global search | 4 |
| 6 | Academics: enrollment, subject allocation, examinations, marks entry, results/grading, backlog/revaluation | 5 |
| 7 | Attendance: marking, correction workflow, reporting/aggregation | 5, 6 (shares subject allocation) |
| 8 | Timetable + conflict detection | 4, 5 |
| 9 | Leave workflow (student + lecturer), wired into attendance | 5 |
| 10 | Dashboards/reports per role, announcements/notifications | 6, 7, 8, 9 |
| 11 | Audit log UI, security hardening pass, full test suite, performance/index review | all |
| 12 | Deployment docs, migration/seed instructions, demo credentials | 11 |

Each phase ships with: the business rule explained, the schema/migration, the API
contract, the UI, validations, and tests — per the working agreement in `README.md`.
Nothing beyond Phase 1 starts without your go-ahead.

## 2. Testing Strategy

- **Unit (Vitest/Jest):** service-layer business rules in isolation — attendance %
  calculation, grading-band resolution, promotion eligibility, ID generation
  uniqueness, timetable clash detection logic.
- **Integration (Supertest + a disposable test DB/schema):** full request→DB round
  trips for the riskiest flows — registration with duplicate ID rejection, login +
  RBAC-gated route access (expect 403 for out-of-scope requests), attendance
  double-submit prevention, marks validation (negative/over-max/unenrolled student
  all rejected), leave approval state machine, publish-then-attempt-silent-edit
  (expect rejection, must go through revision workflow).
- **Frontend (React Testing Library):** form validation surfaces backend/Zod errors
  correctly; role-based conditional rendering; profile tabs load and paginate.
- **E2E (Playwright):** one happy-path per role (Admin registers a student → Lecturer
  marks attendance and enters marks → Student views results and applies for leave →
  HOD approves → Principal views dashboard numbers reflect it).
- Seed data: synthetic names/IDs only (no real student/staff data), generated via a
  `database/seeds/` script, re-runnable against a clean test DB.

## 3. Conflicting / Missing Business Rules — Proposed Defaults

The brief leaves several rules unspecified or internally tense. Proposed defaults
below; flag any you want changed before Phase 3+ locks them into the schema.

1. **Approved leave inside the attendance denominator.** The brief says "define how
   approved leave affects the denominator; don't silently count as absent" but
   doesn't pick a formula. **Default:** approved leave is excluded from both
   numerator and denominator (same treatment as holidays/cancelled sessions) and
   shown as its own stat ("Attendance 92%, of which 3 sessions on approved leave
   excluded") rather than folded into "present." Alternative (counts as present) is
   a one-line config flag if you'd rather.
2. **Who can edit "published" results.** Spec says results are immutable after
   publish but also wants a "revaluation" workflow. **Default:** only Admin or HOD
   (same department) can initiate a revision, and it always requires a `reason` and
   produces a `result_revisions` row — no direct UPDATE path exists at all, even
   for those roles.
3. **HOD scope boundary.** Spec gives HOD department-wide management rights but
   also gives Lecturers rights only over "their" classes — unclear whether an HOD
   can edit marks a Lecturer already entered. **Default:** HOD can view everything
   in-department and can *override* pre-publish marks (logged as a distinct actor
   in audit), but cannot bypass the publish-lock any more than anyone else.
4. **Student self-service edit scope.** Students can "view their complete profile"
   but the brief doesn't say what, if anything, they can edit. **Default:** students
   may edit only contact fields (mobile, current address, guardian contact) and
   document uploads; everything academic is read-only to them.
5. **Lecturer profile self-edit.** Same ambiguity. **Default:** mirrors students —
   contact info + document uploads editable, employment/professional fields are
   Admin/HOD-only.
6. **ID format configurability.** Spec gives examples (`STU2026001`) but "configurable
   ID generation rules" isn't specified further. **Default:** `id_sequences` table
   keyed by `(entity_type, year)` with a configurable prefix and zero-padded
   sequence width (default 3 digits, rolls to 4 if exceeded in a year) — avoids
   ever needing a schema change to raise the ceiling.
7. **Multiple sessions per subject per day.** Attendance dedup rule says "prevent
   duplicate attendance for the same subject/date unless a multiple-session
   schedule applies" — this requires `class_sessions` to carry a `period_number`,
   which is what makes the uniqueness `(class_session_id, student_id)` rather than
   `(subject_id, student_id, date)`. Confirmed as the model used in DATABASE.md.
8. **Grading scale granularity.** "Make grading configurable" — **default:** scoped
   per academic year (not per course), so an institution-wide policy change doesn't
   require touching every course, but a program with genuinely different grading
   can still get its own scale by assigning it directly.
9. **Principal vs Admin overlap.** Both see "college-wide" data; spec gives Admin
   the CRUD rights and Principal mostly view + approvals. **Default:** Principal's
   write surface is limited to an explicit `approvals` queue (e.g., sign-off on
   results publication at college level, policy announcements) — everything else
   stays Admin-only to avoid two roles able to silently diverge on master data.
10. **Timetable "classroom" as a real resource vs free text.** Spec mentions
    classroom allocation conflict-checking, which requires classrooms to be a real
    entity, not a text field. **Default:** add a lightweight `classrooms` table
    (`id`, `name`, `capacity`) even though the spec's table catalog in section 15
    didn't explicitly list one — needed to make the stated conflict rule
    enforceable at the DB level.

## 4. Deployment (Phase 12 preview)
- Environment-variable matrix documented in `.env.example` (DB connection, JWT
  secrets, file storage, SMTP) once scaffolding lands.
- Migration tool: a SQL-Server-compatible runner (e.g. `node-mssql` + a thin
  migration script, or `knex` with the mssql dialect) — decided in Phase 2.
- Demo credentials seeded per role in `database/seeds/`, clearly marked non-production.
