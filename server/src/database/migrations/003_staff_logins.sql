-- Staff (admin/hod/lecturer/principal) accounts have no separate profile
-- table the way students and guardians do — they're just a users row plus a
-- role. full_name lets the UI show something better than a bare email for
-- them without needing a whole new entity for now.
ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NULL;
