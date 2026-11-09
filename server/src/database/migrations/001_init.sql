-- Core identity
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(80) UNIQUE NOT NULL,
  description VARCHAR(200) NOT NULL
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  public_id VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','disabled')),
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_department_id INT NULL
);

-- COALESCE collapses NULL scope to 0 so the uniqueness check still catches
-- true duplicates (same user+role+scope, including the college-wide/NULL case)
-- without violating NOT NULL-in-PK semantics for the nullable scope column.
CREATE UNIQUE INDEX uq_user_roles_scope
  ON user_roles (user_id, role_id, COALESCE(scope_department_id, 0));

-- ID sequence generator (configurable per entity/year)
CREATE TABLE id_sequences (
  entity_type VARCHAR(30) NOT NULL,
  year INT NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  pad_width INT NOT NULL DEFAULT 3,
  next_value INT NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_type, year)
);

-- Master data
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  public_id VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  public_id VARCHAR(30) UNIQUE NOT NULL,
  department_id INT NOT NULL REFERENCES departments(id),
  name VARCHAR(150) NOT NULL,
  duration_years INT NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id),
  year_of_study INT NOT NULL,
  name VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (course_id, year_of_study, name)
);

-- Students
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id),
  public_id VARCHAR(30) UNIQUE NOT NULL,
  admission_number VARCHAR(40) UNIQUE NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80) NULL,
  last_name VARCHAR(80) NOT NULL,
  dob DATE NOT NULL CHECK (dob < now()),
  gender VARCHAR(20) NOT NULL,
  blood_group VARCHAR(10) NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NULL,
  photo_url VARCHAR(255) NULL,
  permanent_address TEXT NULL,
  current_address TEXT NULL,
  nationality VARCHAR(80) NULL,
  department_id INT NOT NULL REFERENCES departments(id),
  course_id INT NOT NULL REFERENCES courses(id),
  current_section_id INT NULL REFERENCES sections(id),
  current_year_of_study INT NOT NULL DEFAULT 1,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_institution VARCHAR(200) NULL,
  previous_qualification VARCHAR(150) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','promoted','transferred','graduated','withdrawn','archived')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INT NULL REFERENCES users(id)
);

CREATE INDEX idx_students_dept ON students(department_id);
CREATE INDEX idx_students_course ON students(course_id);
CREATE INDEX idx_students_name ON students(first_name, last_name);

CREATE TABLE student_guardians (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact_number VARCHAR(20) NULL,
  email VARCHAR(150) NULL
);

CREATE TABLE student_documents (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type VARCHAR(60) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  verified_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verified_status IN ('pending','verified','rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by INT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_academic_history (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  department_id INT NOT NULL REFERENCES departments(id),
  course_id INT NOT NULL REFERENCES courses(id),
  section_id INT NULL REFERENCES sections(id),
  year_of_study INT NOT NULL,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN ('enrolled','promoted','transferred','repeated','graduated','withdrawn')),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by INT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(60) NOT NULL,
  before_json JSONB NULL,
  after_json JSONB NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
