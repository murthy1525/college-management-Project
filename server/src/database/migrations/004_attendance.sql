-- Basic daily attendance. Deliberately not tied to subjects/periods/timetable
-- (that infrastructure doesn't exist yet) — one record per student per
-- calendar day, which is enough for a real attendance % and trend charts.
CREATE TABLE student_attendance (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
  marked_by INT NOT NULL REFERENCES users(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);

CREATE INDEX idx_attendance_date ON student_attendance(attendance_date);
CREATE INDEX idx_attendance_student ON student_attendance(student_id);
