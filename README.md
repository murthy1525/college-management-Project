# College Management System (CMS)

A College Management System covering departments/courses, student lifecycle,
document upload, academic history, and a progress-card workflow requiring both a
staff and a parent signature — with real self-service portals for parents and
students on top of the admin/HOD console.

**Status:** Running and tested. Phases 1–5 of the original roadmap are implemented
(auth, master data, students, documents, guardians/progress-cards), plus a
parent/student self-service slice. Attendance, examinations, assignments,
timetable, and leave workflow are designed in `docs/` but not yet built — see
[docs/END_TO_END.md](docs/END_TO_END.md) §9 for the full list of what's in and what's next.

## Stack
- **Frontend:** React 18 + TypeScript + Vite, React Router, Tailwind CSS v4, TanStack Query, Axios
- **Backend:** Node.js + Express + TypeScript, JWT auth + Argon2id, RBAC enforced server-side
- **Database:** PostgreSQL (the original plan specified SQL Server; Postgres was used for local runnability — see END_TO_END.md §2)
- **Testing:** Vitest + Supertest (backend, 38 passing), Playwright (E2E, 3 passing)

## Quick start
See [docs/END_TO_END.md](docs/END_TO_END.md) §4 for full setup. Short version:
```bash
cd server && npm install && npm run migrate && npm run seed && npm run dev   # :4500
cd client && npm install && npm run dev                                      # :5173
```
Log in at `http://localhost:5173` with the seeded admin (`admin@cms.local` by
default — see `server/.env`).

## Docs (read in this order)
1. **[docs/END_TO_END.md](docs/END_TO_END.md)** — the whole system in one document: what's built, how to run it, role-by-role tour, security posture, test coverage, known simplifications
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, roles/permissions, folder structure, nav
3. [docs/DATABASE.md](docs/DATABASE.md) — ER diagram, tables, relationships, lifecycle rules
4. [docs/API.md](docs/API.md) — REST endpoint design
5. [docs/SECURITY.md](docs/SECURITY.md) — authN/authZ, audit logging, data protection
6. [docs/ROADMAP.md](docs/ROADMAP.md) — phased delivery plan with dependencies, testing strategy, open questions

## Working agreement
Every module gets its own explanation of the business requirement, the data model,
the API contract, and tests before being marked done — see commit history and
`docs/END_TO_END.md` §10 for current test coverage.
