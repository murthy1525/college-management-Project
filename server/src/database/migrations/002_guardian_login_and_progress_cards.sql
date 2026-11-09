-- Lets a guardian row be backed by a real login, so a parent can sign in
-- and see only the children they are linked to.
ALTER TABLE student_guardians ADD COLUMN user_id INT NULL REFERENCES users(id);
CREATE INDEX idx_guardians_user ON student_guardians(user_id);

-- Progress cards require both a staff sign-off and a parent sign-off before
-- they count as complete. Signatures are separate nullable (who, when) pairs
-- rather than a single boolean, so each signature carries its own audit trail.
CREATE TABLE progress_cards (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term VARCHAR(100) NOT NULL,
  remarks TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'awaiting_signatures'
    CHECK (status IN ('awaiting_signatures', 'fully_signed')),
  created_by INT NOT NULL REFERENCES users(id),
  teacher_signed_by INT NULL REFERENCES users(id),
  teacher_signed_at TIMESTAMPTZ NULL,
  parent_signed_by INT NULL REFERENCES users(id),
  parent_signed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_progress_cards_student ON progress_cards(student_id);
