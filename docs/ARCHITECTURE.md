# Architecture

## 1. System Overview

The CMS is a multi-role, multi-department platform. A single backend exposes REST APIs
consumed by a single React SPA whose UI adapts per role (not separate apps per role —
one codebase, route-guarded and component-guarded by permission, matching how most
real institutions actually run this: one login portal, different landing dashboards).

```
┌─────────────────────────────────────────────────────────────┐
│                         React SPA (Vite)                      │
│  Role-aware routing → Principal / Admin / HOD / Lecturer /    │
│  Student dashboards, all sharing one component library        │
└───────────────────────────┬────────────────────────────────────┘
                            │ REST (JSON over HTTPS), JWT bearer
┌───────────────────────────▼────────────────────────────────────┐
│                      Express API (TypeScript)                  │
│  middleware: auth → rbac → validation(zod) → controller        │
│  modules/: students, lecturers, principals, departments,       │
│  academics, attendance, examinations, assignments,             │
│  timetable, leaves, reports, notifications, audit, search      │
└───────────────────────────┬────────────────────────────────────┘
                            │ parameterized queries / query builder, transactions
┌───────────────────────────▼────────────────────────────────────┐
│                     Microsoft SQL Server                       │
│  Normalized schema, FKs, unique + check constraints, indexes   │
└──────────────────────────────────────────────────────────────┘
```

**Why one SPA instead of five:** the spec's roles share most of the chrome (nav, search,
notifications, profile viewer) and a lot of logic (attendance %, grading) is identical
across who's viewing it. Splitting into five apps would duplicate that and make
cross-role features (Principal drilling into a Lecturer's profile) awkward. Role
differences are expressed as: route guards, conditionally rendered components, and
backend authorization — never as separate deployable frontends.

## 2. Module Breakdown

| Module | Responsibility |
|---|---|
| `authentication` | Login, refresh, logout, password reset, lockout policy |
| `users` | Account lifecycle, role assignment, status management |
| `students` | Registration, profile, documents, lifecycle (promote/transfer/graduate/withdraw) |
| `lecturers` | Registration, profile, qualifications, employment history |
| `principals` | Principal/admin staff profiles, institutional responsibility records |
| `departments` | Departments, courses, academic years, semesters, sections, subjects |
| `guardians` | Parent/guardian records per student, optional parent portal login provisioning |
| `progress-cards` | Per-term progress cards requiring both a staff and a parent signature before completion |
| `me` | Self-service lookup for a parent ("my children") or student ("my profile") login |
| `academics` | Enrollment, subject allocation, grading-rule configuration |
| `attendance` | Student + lecturer attendance, correction workflow, aggregation |
| `examinations` | Exam scheduling, marks entry, results, backlog, revaluation |
| `assignments` | Assignment creation, submission, grading/feedback |
| `timetable` | Timetable CRUD with conflict detection |
| `leaves` | Leave application/approval workflow (students + lecturers) |
| `reports` | Cross-module aggregation for dashboards (read-only, denormalized views) |
| `notifications` | Announcements + targeted notifications, visibility scoping |
| `audit` | Write-path interceptor logging who/what/when/before→after |
| `search` | Global unique-ID / name search across person types |

Each module is a vertical slice: `routes → controller → service → repository`, with its
own `validators/` (Zod schemas shared with frontend where practical) and `tests/`.

## 3. Role & Permission Matrix

Permissions are enforced on the backend via RBAC middleware; frontend hiding of
buttons is cosmetic only, never the actual gate.

| Capability | Principal | Admin | HOD | Lecturer | Student | Parent |
|---|---|---|---|---|---|---|
| View college-wide dashboard/stats | ✅ | ✅ | Dept-scoped | ❌ | ❌ | ❌ |
| Create/edit department, course, academic year | View | ✅ | View | ❌ | ❌ | ❌ |
| Register / edit student | View | ✅ | Dept-scoped | ❌ | Own profile (contact fields only) | ❌ |
| Register / edit lecturer | View | ✅ | Dept view | Own profile (contact fields only) | ❌ | ❌ |
| View a student's full profile | ✅ | ✅ | Dept-scoped | Class-scoped | Self only | Own linked child(ren) only |
| Mark student attendance | ❌ | ❌ | Dept view | ✅ (own classes) | ❌ | ❌ |
| Approve attendance corrections | ❌ | ✅ | ✅ (dept) | ❌ (can request) | ❌ (can request) | ❌ |
| Enter internal exam marks | ❌ | ❌ | Dept view | ✅ (own subjects) | ❌ | ❌ |
| Publish results | ❌ | ✅ | ✅ (dept, with admin co-sign for backlog/reval) | ❌ | ❌ | ❌ |
| Create/manage timetable | ❌ | ✅ | ✅ (dept) | View own | View own | ❌ |
| Approve leave | ❌ | ✅ (staff) | ✅ (dept student/lecturer) | ❌ (can request own) | ❌ (can request own) | ❌ |
| Submit assignment | ❌ | ❌ | ❌ | Grade only | ✅ | ❌ |
| Create a progress card | ❌ | ✅ | ✅ | ✅ (own subject's students) | ❌ | ❌ |
| Sign a progress card as staff | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Sign a progress card as parent | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (own linked child only) |
| Create a guardian's parent-portal login | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ (summary) | ✅ (full) | Dept-scoped | ❌ | ❌ | ❌ |
| Global person search | ✅ | ✅ | Dept-scoped | Class-scoped | Self only | ❌ |
| View salary / HR data | ❌ | HR role only | ❌ | ❌ | ❌ | ❌ |

**Progress cards are intentionally dual-gated**: a card is "awaiting_signatures" until
*both* an authorized staff member signs (as the teacher of record) *and* the student's
linked parent/guardian signs — either order is allowed, but neither signature can be
replaced once given, and a parent can only ever sign a card for their own linked
child (enforced server-side against `student_guardians`, not just hidden in the UI).

Implementation: a `permissions` table of fine-grained flags (`student.create`,
`attendance.mark`, `marks.publish`, …) grouped into `roles`, joined via `user_roles`.
Department/class scoping is enforced in the query layer (service functions take the
caller's scope and intersect it with the request), not just in middleware — so a
Lecturer token can never fetch another lecturer's class roster even by guessing an ID.

## 4. Frontend Navigation Structure

```
/login
/forgot-password
/app
  /dashboard                     (role-specific landing, same route, different component)
  /search?q=                     (global ID/name search)
  /students
    /                            (list, admin/HOD/principal)
    /new                         (admin/HOD)
    /:studentId                  (profile shell)
      /overview /personal /academic-history /attendance /examinations
      /assignments /timetable /leaves /documents /activity
  /lecturers                     (mirrors /students)
    /:lecturerId/...
  /departments /courses /academic-years /semesters /sections /subjects  (admin)
  /attendance
    /mark                        (lecturer: pick class → roster → mark)
    /corrections                 (requests + approvals, scoped by role)
    /reports                     (monthly/semester, filters)
  /examinations
    /schedule /marks-entry /results /backlog /revaluation
  /assignments
    /                            (lecturer: manage; student: view/submit)
  /timetable                     (dept/class/lecturer views + conflict-checked editor)
  /leaves
    /apply /my-applications /approvals (role-gated)
  /announcements
  /audit-logs                    (principal/admin)
  /profile                       (self)
```

Shared component library (`components/`): `DataTable` (sort/paginate), `ProfileTabs`,
`SearchBar`, `FilterBar`, `ConfirmDialog`, `Toast`, `EmptyState`, `LoadingState`,
`StatCard`, form primitives wired to React Hook Form + Zod.

## 5. Backend Folder Structure

```
server/
  src/
    config/              # env loading, db pool config
    database/            # connection, migration runner
    modules/
      authentication/
      users/
      students/
      lecturers/
      principals/
      departments/        # also owns courses/years/semesters/sections/subjects
      academics/           # enrollment, allocation, grading config
      attendance/
      examinations/
      assignments/
      timetable/
      leaves/
      reports/
      notifications/
      audit/
      search/
      <each>/
        <module>.routes.ts
        <module>.controller.ts
        <module>.service.ts
        <module>.repository.ts
        <module>.types.ts
    middleware/
      auth.middleware.ts        # verifies JWT
      rbac.middleware.ts        # checks permission flags
      validate.middleware.ts    # Zod schema validation
      error.middleware.ts       # centralized error → HTTP mapping
      audit.middleware.ts       # captures before/after on mutating routes
    validators/          # Zod schemas (mirrored on frontend via shared package where feasible)
    utils/
    routes/              # top-level router assembly
    tests/
      unit/
      integration/
```

## 6. Frontend Folder Structure

```
client/
  src/
    components/          # generic, reusable, no business logic
    layouts/              # AppShell, AuthLayout
    pages/                # route-level composition only
    modules/
      authentication/ students/ lecturers/ principals/
      attendance/ academics/ examinations/ timetable/
      leaves/ reports/ notifications/
      <module>/{components, hooks, api.ts, types.ts}
    hooks/                # cross-module hooks (useAuth, usePermission)
    services/             # axios instance, interceptors (refresh-token retry)
    schemas/              # Zod schemas shared with forms
    types/
    utils/
    routes/               # route tree + guards
```

## 7. Security Architecture

See [SECURITY.md](SECURITY.md) for detail. Summary: JWT access token (short-lived) +
httpOnly refresh token, Argon2id password hashing, RBAC enforced server-side on every
mutating and sensitive read route, parameterized queries only (no string-built SQL),
rate limiting on auth endpoints, centralized audit logging on every write.

## 8. Cross-Cutting Decisions

- **No hard deletes anywhere.** Every lifecycle table carries a status column
  (`active`, `graduated`, `withdrawn`, `archived`, etc.); "delete" in the UI means
  status transition, never a SQL `DELETE` of academic history.
- **Historical data is append-only.** Promotions, department transfers, and semester
  results each get their own row in a history table; the "current" view is a query
  (latest row per student), not a mutated field.
- **Grading is configurable**, not hardcoded: a `grading_scales` + `grade_bands` table
  per academic year/program, referenced when computing letter grades.
