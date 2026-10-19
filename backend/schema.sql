-- SmarTutor database schema (PostgreSQL). Safe to run more than once.
-- Row level security is enabled on every table with no policies, so Supabase's public REST API
-- exposes nothing. The backend connects with a direct Postgres connection string, which is not
-- subject to these rules.

create table if not exists users (
  id integer generated always as identity primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('student', 'tutor')),
  created_at timestamptz not null default now()
);

create table if not exists tutor_profiles (
  user_id integer primary key references users(id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  subjects text not null default '',
  hourly_rate_cents integer not null default 0,
  location text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id integer generated always as identity primary key,
  tutor_id integer not null references users(id),
  student_id integer not null references users(id),
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'completed', 'cancelled')),
  stripe_session_id text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- A course is a multi-session package a tutor sells at one price.
create table if not exists courses (
  id integer generated always as identity primary key,
  tutor_id integer not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  subject text not null default '',
  total_sessions integer not null check (total_sessions between 2 and 52),
  sessions_per_week integer not null default 1 check (sessions_per_week between 1 and 3),
  session_minutes integer not null check (session_minutes between 30 and 180),
  price_cents integer not null check (price_cents > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A student's purchase of a course. Prices are copied here so later edits never change them.
create table if not exists enrollments (
  id integer generated always as identity primary key,
  course_id integer not null references courses(id),
  student_id integer not null references users(id),
  tutor_id integer not null references users(id),
  starts_at timestamptz not null,
  amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'completed', 'cancelled')),
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table if not exists course_sessions (
  id integer generated always as identity primary key,
  enrollment_id integer not null references enrollments(id) on delete cascade,
  session_number integer not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  completed_at timestamptz,
  unique (enrollment_id, session_number)
);

-- A review belongs to exactly one thing: a single booking or a whole course enrollment.
create table if not exists reviews (
  id integer generated always as identity primary key,
  booking_id integer unique references bookings(id),
  enrollment_id integer unique references enrollments(id),
  tutor_id integer not null references users(id),
  student_id integer not null references users(id),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  check ((booking_id is not null)::int + (enrollment_id is not null)::int = 1)
);

create index if not exists idx_bookings_tutor on bookings(tutor_id);
create index if not exists idx_bookings_student on bookings(student_id);
create index if not exists idx_courses_tutor on courses(tutor_id);
create index if not exists idx_enrollments_student on enrollments(student_id);
create index if not exists idx_enrollments_tutor on enrollments(tutor_id);
create index if not exists idx_enrollments_course on enrollments(course_id);
create index if not exists idx_reviews_tutor on reviews(tutor_id);

alter table users enable row level security;
alter table tutor_profiles enable row level security;
alter table bookings enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table course_sessions enable row level security;
alter table reviews enable row level security;
