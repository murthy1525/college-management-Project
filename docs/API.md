# API Design

Base path: `/api`. JSON in/out. Consistent envelope:

```json
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "pageSize": 20, "total": 134 } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

Status codes: `200` OK, `201` Created, `204` No Content, `400` validation,
`401` unauthenticated, `403` unauthorized (authenticated but lacks permission/scope),
`404` not found, `409` conflict (e.g., duplicate attendance, timetable clash),
`422` business-rule violation (e.g., marks > max), `500` unexpected.

## Authentication
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

## Search (global)
```
GET    /api/search?q=STU2026001&type=student|lecturer|principal&page=1
```
Exact `public_id`/`admission_number`/`employee_id` match ranked first; falls back to
indexed partial name match scoped by caller's permissions. Caller's role determines
which fields come back (e.g., a Lecturer searching gets name/photo/role/class — never
another student's guardian contact info).

## Departments / Courses / Academic Structure
```
GET/POST        /api/departments
GET/PUT         /api/departments/:id
GET/POST        /api/courses
GET/POST        /api/academic-years
GET/POST        /api/semesters
GET/POST        /api/sections
GET/POST        /api/subjects
GET/POST        /api/grading-scales
```

## Students
```
POST   /api/students                       # register
GET    /api/students?departmentId&courseId&sectionId&status&page
GET    /api/students/:studentId            # profile overview
PUT    /api/students/:studentId            # edit
GET    /api/students/:studentId/history            # academic history (tab 3)
GET    /api/students/:studentId/attendance          # tab 4
GET    /api/students/:studentId/marks               # tab 5
GET    /api/students/:studentId/assignments         # tab 6
GET    /api/students/:studentId/timetable           # tab 7
GET    /api/students/:studentId/leaves               # tab 8
GET    /api/students/:studentId/documents            # tab 9
GET    /api/students/:studentId/activity              # tab 10 (audit trail)
POST   /api/students/:studentId/documents
POST   /api/students/:studentId/promote
POST   /api/students/:studentId/transfer
POST   /api/students/:studentId/graduate
POST   /api/students/:studentId/withdraw
```

## Lecturers (mirrors students)
```
POST/GET   /api/lecturers
GET/PUT    /api/lecturers/:lecturerId
GET        /api/lecturers/:lecturerId/{history,qualifications,employment-history,
                                        allocations,timetable,attendance,leaves,
                                        workload,documents,activity}
```

## Principals
```
GET/POST   /api/principals
GET/PUT    /api/principals/:principalId
```

## Attendance
```
POST   /api/attendance                       # bulk mark for a class_session
PATCH  /api/attendance/:id                   # individual correction (pre-correction-workflow, same-day)
GET    /api/attendance?sectionId&subjectId&date
GET    /api/students/:studentId/attendance/summary?semesterId
POST   /api/attendance/corrections           # raise a correction request
PATCH  /api/attendance/corrections/:id/approve
PATCH  /api/attendance/corrections/:id/reject
GET    /api/lecturer-attendance?lecturerId&month
POST   /api/lecturer-attendance/check-in
POST   /api/lecturer-attendance/check-out
```

## Academics / Examinations
```
POST/GET  /api/examinations
POST      /api/examinations/:examId/subjects
POST      /api/examinations/:examId/marks          # entry, validated against enrollment + max_marks
GET       /api/examinations/:examId/marks
POST      /api/examinations/:examId/publish        # locks marks, computes results
GET       /api/students/:studentId/results?semesterId
POST      /api/results/:resultId/revise             # authorized correction, requires reason
GET       /api/backlogs?studentId|departmentId
POST      /api/revaluations
```

## Assignments
```
POST/GET  /api/assignments?allocationId
GET       /api/assignments/:id
POST      /api/assignments/:id/submissions          # student submits
GET       /api/assignments/:id/submissions           # lecturer views
PATCH     /api/assignments/:id/submissions/:subId    # lecturer grades + feedback
```

## Timetable
```
GET/POST  /api/timetable?sectionId|lecturerId|departmentId
PUT       /api/timetable/:id                 # conflict-checked (409 on clash)
DELETE    /api/timetable/:id                 # status-based removal, not hard delete of history
```

## Leaves
```
POST    /api/leaves
GET     /api/leaves?applicantId|status|departmentId
PATCH   /api/leaves/:leaveId/approve
PATCH   /api/leaves/:leaveId/reject
PATCH   /api/leaves/:leaveId/cancel
```

## Announcements / Notifications
```
POST/GET  /api/announcements?scopeType&scopeId
GET       /api/notifications?unread=true
PATCH     /api/notifications/:id/read
```

## Reports / Dashboards
```
GET  /api/reports/dashboard/principal
GET  /api/reports/dashboard/hod?departmentId
GET  /api/reports/dashboard/lecturer
GET  /api/reports/dashboard/student
GET  /api/reports/attendance?scope=...&from&to
GET  /api/reports/academic-performance?scope=...
```

## Audit
```
GET  /api/audit-logs?entityType&entityId&userId&from&to&page
```

All endpoints documented in OpenAPI/Swagger at `/api/docs` once implemented
(`swagger-jsdoc` + `swagger-ui-express`), generated from the Zod validators so the
schema can't drift from the actual request contract.
