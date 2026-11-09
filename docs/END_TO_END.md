# College Management System — End-to-End Documentation

This document walks through the whole system as it exists today: what it does, how
it's built, how to run it, and what's still ahead. For narrower references, see:
[ARCHITECTURE.md](ARCHITECTURE.md) (module/folder structure), [DATABASE.md](DATABASE.md)
(full schema + ER diagram), [API.md](API.md) (planned REST surface), [SECURITY.md](SECURITY.md)
(auth/authz model), [ROADMAP.md](ROADMAP.md) (phased plan + open decisions).

## 1. What this is

A College Management System covering departments/courses, student registration and
lifecycle, document upload, academic history, and a **progress-card workflow that
requires both a staff signature and a parent signature** before a card counts as
complete. There's a real self-service portal for parents (see only their own
children) and students (see only themselves), on top of the full admin/HOD console.

Nothing in the running system is mock or hardcoded: every number on the dashboard,
every list, every status badge is a live query against PostgreSQL. The only
non-business data created automatically is the RBAC catalog (roles/permissions) and
one bootstrap admin login — see `server/src/database/seed.ts`.

## 2. Tech stack (as actually built)

| Layer | Choice | Note |
|---|---|---|
| Backend | Node.js + Express + TypeScript | layered: `routes → controller → service → repository` |
| Database | PostgreSQL | local dev instance; see §4 |
| Auth | JWT (access token) + Argon2id password hashing | account lockout after 5 failed attempts (15 min) |
| File upload | Multer (memory storage) + magic-byte sniffing | client-supplied MIME/extension is never trusted |
| Frontend | React 18 + TypeScript + Vite | Tailwind CSS v4, TanStack Query, React Router, Axios |
| Backend tests | Vitest + Supertest | against a dedicated `cms_test` database |
| E2E tests | Playwright (Chromium) | drives the real dev servers in a real browser |

The original planning docs (`ARCHITECTURE.md`, `DATABASE.md`) specified SQL Server;
the implementation uses PostgreSQL instead, since that's what was available to run
locally. The schema design translates directly — no SQL Server–specific features
were assumed.

## 3. Project layout

```
college-management-system/
  server/           Express API (TypeScript)
    src/
      config/        env loading, pg pool
      middleware/     auth (JWT verify + RBAC), centralized error handling
      modules/        one folder per feature (see §6)
      utils/          asyncHandler, audit log writer, JWT helpers, ID generator,
                      file-signature (magic-byte) detector
      database/       migrations/, migrate.ts, seed.ts
      tests/          Vitest + Supertest integration tests
  client/           React + Vite frontend
    src/
      auth/           AuthContext, ProtectedRoute, StaffOnlyRoute
      components/     Button, Layout, PageHeader, Skeleton, StatusBadge, ...
      pages/          one file per route
      lib/api.ts      axios instance + token storage + error extraction
  e2e/              Playwright suite, runs against the live dev servers
  docs/             this folder
```

## 4. Running it locally

**Prerequisites:** Node.js 24+, PostgreSQL reachable at `127.0.0.1:5432` with a
`postgres` superuser (trust auth locally is fine for dev).

```bash
# 1. Database
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE cms_dev;"

# 2. Backend
cd server
npm install
npm run migrate      # applies server/src/database/migrations/*.sql in order
npm run seed         # creates roles + ONE admin login (admin@cms.local / Admin@12345
                      # by default — see .env's SEED_ADMIN_EMAIL/PASSWORD)
npm run dev          # http://localhost:4500

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev          # http://localhost:5173, proxies /api to :4500

# 4. Log in
# http://localhost:5173 -> admin@cms.local / Admin@12345
```

**Running the test suites:**

```bash
# Backend integration tests (spins up its own cms_test schema each run)
cd server && npm test

# Frontend type-check
cd client && npx tsc -b --noEmit

# End-to-end (both dev servers must already be running)
cd e2e && npx playwright test
```

**Environment variables** (`server/.env`, see `.env.example` for the template):
`DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `UPLOAD_DIR`,
`MAX_UPLOAD_MB`, `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. None of these are committed
with real values.

## 5. Roles and what each one can actually do

Enforced **server-side**, in the service layer — not just hidden in the UI. See
`server/src/modules/students/students.access.ts` for the ownership-scoping helper
that backs all of this.

| Role | How they land | What they see |
|---|---|---|
| **admin** | Full dashboard | Everything: departments, courses, all students, all documents, can create/sign progress cards, can provision parent and student logins |
| **hod** | Full dashboard | Same write surface as admin for students/progress-cards (department scoping is a documented simplification — see §9) |
| **lecturer** | Full dashboard | Can create progress cards and sign as teacher; no department/course/student-creation rights |
| **parent** | "My Children" list | Only the student(s) linked via `student_guardians.user_id`; read-only profile, can sign a progress card's parent slot — nothing else |
| **student** | Redirected straight to their own profile | Only their own record (`students.user_id`), read-only |

A parent or student hitting `/departments`, `/courses`, or `/students` (the list) is
redirected home by `StaffOnlyRoute` on the frontend — and would get a 403 from the
backend regardless if they bypassed the UI.

## 6. Backend modules (what each one owns)

| Module | Routes mounted at | Responsibility |
|---|---|---|
| `auth` | `/api/auth` | login (with lockout), `/me` |
| `departments` | `/api/departments` | CRUD + active/inactive toggle |
| `courses` | `/api/courses` | CRUD + active/inactive toggle, scoped to a department |
| `students` | `/api/students` | registration, profile, lifecycle, document upload/view/toggle, login provisioning |
| `guardians` | `/api/students/:id/guardians` | guardian records, optional parent-login creation |
| `progress-cards` | `/api/students/:id/progress-cards` | create, sign-as-teacher, sign-as-parent |
| `dashboard` | `/api/dashboard/summary` | live counts + recent audit activity |
| `me` | `/api/me/students` | "which student(s) am I allowed to see" for parent/student logins |

Every module follows the same four files: `*.routes.ts` (wiring + RBAC middleware),
`*.controller.ts` (request/response only), `*.service.ts` (business rules,
transactions, authorization checks), `*.repository.ts` (parameterized SQL only).

## 7. The progress-card signature workflow (the feature you asked to be "mandatory")

1. Staff (admin/hod/lecturer) creates a card for a student with a `term` and optional
   `remarks`. It starts `awaiting_signatures`.
2. Staff signs as teacher (`PATCH .../sign-teacher`) — records `teacher_signed_by`/`_at`.
3. The linked parent signs (`PATCH .../sign-parent`) — records `parent_signed_by`/`_at`,
   and **only if** a `student_guardians` row links their login to that exact student.
4. The card's `status` becomes `fully_signed` only once *both* signatures are present.
   It's computed server-side on every sign call — the client never sets it directly.
5. Either signature can be given in either order; neither can be re-given once set
   (a repeat attempt returns `409 ALREADY_SIGNED`, not a silent overwrite).

The UI shows this as two colored panels (pending vs. signed, with who/when) and a
single status badge (rose "Awaiting Signatures" / green "Fully Signed") — see
`client/src/pages/StudentDetailPage.tsx` and `ProgressCardStatusBadge.tsx`.

## 8. Security posture (what's actually in place, not just planned)

- Argon2id password hashing; account lockout after 5 failed logins (15 min).
- Every async route is wrapped so a thrown error reaches the error middleware
  instead of crashing the process (`utils/asyncHandler.ts`) — this was a real bug
  caught during build: a single wrong password used to take the whole API down.
- All SQL is parameterized; verified against injection payloads in both automated
  tests and manual curl probes (metacharacter strings stored literally, never executed).
- File uploads are validated by **magic bytes**, not the client-supplied
  `Content-Type` header or filename extension (`utils/fileSignature.ts`) — both of
  those are trivially spoofable and were flagged in an internal security review
  before being fixed.
- RBAC is checked twice: once at the route (`requireRole`) and again inside the
  service against the actual row being touched (`assertCanAccessStudent`), so a
  guessed ID in a URL can't leak another student's/child's data.
- Audit log (`audit_logs` table) redacts password/token fields and records every
  create/update/status-change/document-view with before/after JSON.
- No hard deletes anywhere — every entity uses an `is_active` flag; "removing"
  something is always a status transition, never a `DELETE`.

Full detail and the one-time audit findings (and how they were resolved) are in
[SECURITY.md](SECURITY.md).

## 9. Known simplifications (intentional, not oversights)

- **No separate Lecturer entity/module yet.** "Sign as teacher" is available to any
  login with the `admin`, `hod`, or `lecturer` role — there's no lecturer
  registration, subject allocation, or timetable module built yet (that's Phase 6–8
  in [ROADMAP.md](ROADMAP.md)).
- **HOD has the same write scope as admin** for students/progress-cards today;
  true department-scoping for HOD is a documented follow-up, not yet enforced.
- **Attendance, examinations, assignments, timetable, leave workflow, announcements**
  are designed in the docs (`ARCHITECTURE.md`/`DATABASE.md`) but not implemented —
  this build covers Phases 1–5 of the roadmap (auth, master data, students,
  documents, guardians/progress-cards) plus the parent/student self-service slice.
- **Access/refresh tokens**: only a short-lived access token exists today (stored in
  `sessionStorage` on the frontend); the httpOnly-refresh-cookie rotation described
  in `SECURITY.md` isn't wired up yet, so sessions simply expire after 15 minutes
  with no silent renewal.

## 10. Current test coverage

- **Backend (38 passing tests, Vitest + Supertest):** login success/failure/lockout,
  crash-safety on bad login, RBAC enforcement (role + ownership), token tampering
  rejection, department/course CRUD + status toggle, student CRUD + duplicate
  rejection + SQL-injection-shaped input, document upload with real vs. spoofed file
  content, guardian creation (with/without login), the full dual-signature
  progress-card lifecycle (including rejecting a second signature and cross-student
  signing attempts), and student self-service login provisioning + scoping.
- **End-to-end (3 passing tests, Playwright against a real Chromium browser):**
  unauthenticated redirect, bad-login error display, and the full golden path —
  login → create department/course → register student → upload & view a document →
  add a guardian with a parent login → create and dual-sign a progress card →
  switch to the parent login and confirm restricted UI → toggle active/inactive →
  confirm it disappears from the default list and reappears with "show inactive."

Run `npm test` in `server/` or `npx playwright test` in `e2e/` to reproduce either.
