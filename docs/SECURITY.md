# Security Architecture

## Authentication
- Passwords hashed with **Argon2id** (memory-hard, preferred over bcrypt for new systems).
- **Access token**: short-lived JWT (15 min), sent as `Authorization: Bearer`.
- **Refresh token**: longer-lived, stored as an **httpOnly, Secure, SameSite=Strict**
  cookie, rotated on every use, revocable (stored hashed in a `refresh_tokens` table
  so logout/compromise can invalidate server-side — a pure stateless JWT can't be
  revoked early).
- Login attempt protection: exponential backoff + account lock after N failures,
  tracked on `users.failed_login_count` / `locked_until`.
- Password reset: single-use, time-boxed token emailed to the registered address;
  never reveals whether an email exists (generic "if this account exists..." response).

## Authorization
- Every mutating route and every sensitive read route passes through
  `rbac.middleware.ts`, which checks the caller's permission flags **and** scope
  (department/section/own-record) before the controller runs.
- Scope checks happen again in the service/repository layer against the actual
  row being touched — never trust an ID in the URL to be in-scope just because the
  route-level permission passed (defense in depth against e.g. a Lecturer token
  requesting `/students/:studentId` for a student outside their class).
- Frontend route guards and conditional rendering exist purely for UX; they are
  never the only check for anything that touches data.

## Input Handling
- All request bodies/query/params validated with Zod schemas before reaching a
  controller; invalid input is rejected with `400` and never partially processed.
- All DB access via parameterized queries / query builder — no string-concatenated SQL.
- File uploads: allow-listed MIME types + extensions, size caps per document type,
  virus-scan hook point if available, stored outside the web root with signed,
  time-limited download URLs.

## Transport & Headers
- HTTPS everywhere in non-local environments.
- `helmet` for security headers + CSP; CORS restricted to known frontend origins.
- Rate limiting on `/api/auth/*` and on marks/attendance write endpoints to blunt
  brute-force and accidental hot-loop bugs.
- CSRF protection on cookie-authenticated routes (refresh endpoint) via double-submit
  token, since the access token itself is header-based and not CSRF-exposed.

## Data Protection
- Salary and other HR-sensitive fields live in a separate table
  (`lecturer_salary`) gated by its own permission, never joined into general
  profile queries by default.
- Audit log `before_json`/`after_json` redacts `password_hash` and any token fields
  before serialization — enforced centrally in the audit middleware, not per-call.
- Sensitive profile views (e.g., a Principal opening a student's disciplinary
  record) are themselves logged to `audit_logs` as a `VIEW_SENSITIVE` action.

## Audit Logging
Captured for every create/update/status-change on: students, lecturers, marks,
results, attendance corrections, leave approvals, user/role changes.
Each record: actor, action, entity type + id, before/after (redacted), timestamp,
and — for corrections/revisions specifically — a mandatory human-readable reason.

## Secrets
- DB credentials, JWT signing keys, SMTP/file-storage credentials: environment
  variables only, never committed; `.env.example` documents required keys with no
  real values.
