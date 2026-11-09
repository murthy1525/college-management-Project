# College Management System (CMS)

A production-quality, modular College Management System covering student lifecycle,
lecturer management, attendance, academics/examinations, timetabling, leave workflows,
and role-based reporting.

**Status:** Phase 1 (Requirements & Architecture) — see `docs/`. No application code has
been written yet; this phase is for review and approval before implementation begins.

## Stack
- **Frontend:** React 18 + TypeScript + Vite, React Router, Tailwind CSS, React Hook Form + Zod, TanStack Query, Recharts
- **Backend:** Node.js + Express + TypeScript, JWT auth, RBAC middleware
- **Database:** Microsoft SQL Server
- **Testing:** Vitest/Jest, Supertest, React Testing Library, Playwright

## Docs (read in this order)
1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, roles/permissions, folder structure, nav
2. [docs/DATABASE.md](docs/DATABASE.md) — ER diagram, tables, relationships, lifecycle rules
3. [docs/API.md](docs/API.md) — REST endpoint design
4. [docs/SECURITY.md](docs/SECURITY.md) — authN/authZ, audit logging, data protection
5. [docs/ROADMAP.md](docs/ROADMAP.md) — phased delivery plan with dependencies, testing strategy, open questions

## Working agreement
Per the project brief: nothing beyond Phase 1 (this planning set) is implemented until
it's explicitly approved. Every subsequent module gets its own explanation of the
business requirement, the data model, the API contract, and tests before being marked done.
