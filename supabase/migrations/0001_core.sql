-- Klinik Nissa platform — core schema
-- Applies identically to Supabase Postgres and embedded PGlite.

-- ───────────────────────── helpers ─────────────────────────
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Table % is append-only', tg_table_name;
end;
$$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── staff & auth ─────────────────────────
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  full_name text not null,
  role text not null check (role in ('super_admin','resident_doctor','clinic_assistant','screening_admin')),
  password_hash text not null,
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  mfa_secret_enc text,
  mfa_enabled boolean not null default false,
  is_active boolean not null default true,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_by uuid references staff_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_users_username_key on staff_users (lower(username));
create unique index staff_users_email_key on staff_users (lower(email));
create trigger staff_users_touch before update on staff_users for each row execute function touch_updated_at();

create table staff_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references staff_users(id) on delete cascade,
  stage text not null check (stage in ('active','mfa_pending','mfa_enroll','password_change')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text
);
create index staff_sessions_user_idx on staff_sessions(user_id);

create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_label text,
  action text not null,
  entity text,
  entity_id text,
  ip text,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on audit_log(at desc);
create index audit_log_entity_idx on audit_log(entity, entity_id);
create trigger audit_log_immutable before update or delete on audit_log for each row execute function forbid_mutation();

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references staff_users(id)
);

-- ───────────────────────── CMS ─────────────────────────
create table content_items (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort int not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references staff_users(id),
  unique (collection, slug)
);
create index content_items_collection_idx on content_items(collection, status, sort);
create trigger content_items_touch before update on content_items for each row execute function touch_updated_at();

-- ───────────────────────── files ─────────────────────────
create table files (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique,
  original_name text not null,
  mime text not null,
  size_bytes int not null,
  sha256 text not null,
  purpose text not null check (purpose in ('document','leave','incident','cv')),
  uploaded_by uuid references staff_users(id),
  created_at timestamptz not null default now()
);
create index files_sha_idx on files(sha256);

-- ───────────────────────── clinical: screening ─────────────────────────
create table screening_submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key uuid not null unique,
  submitted_at timestamptz not null default now(),
  lang text not null check (lang in ('ms','en')),
  consent_version text not null,
  consent_at timestamptz not null,
  instruments text not null,
  phq9_score int check (phq9_score between 0 and 27),
  phq9_severity text,
  gad7_score int check (gad7_score between 0 and 21),
  gad7_severity text,
  item9_value int check (item9_value between 0 and 3),
  item9_positive boolean not null default false,
  priority text not null check (priority in ('urgent','review','routine')),
  contact_requested boolean not null default false,
  payload_enc text not null,
  follow_up_status text not null default 'new'
    check (follow_up_status in ('new','in_review','contacted','appointment_booked','no_response','closed')),
  assigned_to uuid references staff_users(id),
  notes_enc text,
  reviewed_at timestamptz,
  retention_until date not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create index screening_submitted_idx on screening_submissions(submitted_at desc);
create index screening_priority_idx on screening_submissions(priority, follow_up_status);
create trigger screening_touch before update on screening_submissions for each row execute function touch_updated_at();

create table screening_events (
  id bigserial primary key,
  submission_id uuid not null references screening_submissions(id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid references staff_users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb
);
create index screening_events_sub_idx on screening_events(submission_id, at);
create trigger screening_events_immutable before update on screening_events for each row execute function forbid_mutation();

create table report_links (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references screening_submissions(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_views int not null default 3,
  views int not null default 0,
  failed_attempts int not null default 0,
  created_by uuid references staff_users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ───────────────────────── integrations ─────────────────────────
create table integration_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','dead')),
  attempts int not null default 0,
  max_attempts int not null default 6,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integration_jobs_due_idx on integration_jobs(status, next_run_at);
create trigger integration_jobs_touch before update on integration_jobs for each row execute function touch_updated_at();

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  transport text not null check (transport in ('demo','smtp')),
  to_addresses text not null,
  subject text not null,
  body_text text not null,
  attachments jsonb not null default '[]'::jsonb,
  message_id text
);

-- ───────────────────────── careers ─────────────────────────
create table job_applications (
  id uuid primary key default gen_random_uuid(),
  position_slug text not null,
  payload_enc text not null,
  cv_file_id uuid references files(id),
  consent_version text not null,
  status text not null default 'received' check (status in ('received','reviewing','shortlisted','closed')),
  created_at timestamptz not null default now(),
  retention_until date not null
);

-- ───────────────────────── HR: leave ─────────────────────────
create table leave_types (
  code text primary key,
  name_ms text not null,
  name_en text not null,
  deducts_balance boolean not null default true,
  requires_attachment boolean not null default false,
  paid boolean not null default true,
  default_days numeric(5,1) not null default 0,
  active boolean not null default true,
  sort int not null default 0
);

create table leave_entitlements (
  user_id uuid not null references staff_users(id) on delete cascade,
  year int not null,
  leave_type text not null references leave_types(code),
  days numeric(5,1) not null,
  primary key (user_id, year, leave_type)
);

create table leave_adjustments (
  id bigserial primary key,
  user_id uuid not null references staff_users(id) on delete cascade,
  year int not null,
  leave_type text not null references leave_types(code),
  delta numeric(5,1) not null,
  reason text not null,
  actor_id uuid references staff_users(id),
  at timestamptz not null default now()
);
create trigger leave_adjustments_immutable before update or delete on leave_adjustments for each row execute function forbid_mutation();

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_users(id) on delete cascade,
  leave_type text not null references leave_types(code),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric(5,1) not null,
  reason text,
  attachment_file_id uuid references files(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewer_id uuid references staff_users(id),
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_requests_user_idx on leave_requests(user_id, start_date);
create index leave_requests_status_idx on leave_requests(status, start_date);

create table public_holidays (
  date date primary key,
  name text not null
);

-- ───────────────────────── roster ─────────────────────────
create table shift_definitions (
  code text primary key,
  label text not null,
  start_time time not null,
  end_time time not null,
  min_staff int not null default 1,
  color text not null default '#00B7B1',
  active boolean not null default true,
  sort int not null default 0
);

create table roster_assignments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shift_code text not null references shift_definitions(code),
  user_id uuid not null references staff_users(id) on delete cascade,
  created_by uuid references staff_users(id),
  created_at timestamptz not null default now(),
  unique (date, shift_code, user_id)
);
create index roster_date_idx on roster_assignments(date);

create table roster_changes (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references staff_users(id),
  action text not null,
  date date not null,
  shift_code text,
  user_id uuid,
  details jsonb not null default '{}'::jsonb
);
create trigger roster_changes_immutable before update or delete on roster_changes for each row execute function forbid_mutation();

create table shift_swaps (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references staff_users(id),
  requester_assignment_id uuid not null references roster_assignments(id) on delete cascade,
  target_user_id uuid not null references staff_users(id),
  target_assignment_id uuid references roster_assignments(id) on delete cascade,
  reason text,
  status text not null default 'pending_peer'
    check (status in ('pending_peer','peer_accepted','approved','rejected','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shift_swaps_touch before update on shift_swaps for each row execute function touch_updated_at();

create table shift_swap_events (
  id bigserial primary key,
  swap_id uuid not null references shift_swaps(id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid references staff_users(id),
  action text not null,
  note text
);
create trigger shift_swap_events_immutable before update on shift_swap_events for each row execute function forbid_mutation();

-- ───────────────────────── incidents ─────────────────────────
create table incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  category text not null check (category in ('medication_inventory','missing_stock','equipment','safety','patient_complaint','operational','other')),
  occurred_at timestamptz not null,
  location text,
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  confidential boolean not null default false,
  reporter_id uuid not null references staff_users(id),
  assigned_to uuid references staff_users(id),
  corrective_action text,
  status text not null default 'open' check (status in ('open','investigating','action_required','resolved','closed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger incidents_touch before update on incidents for each row execute function touch_updated_at();

create table incident_files (
  incident_id uuid not null references incidents(id) on delete cascade,
  file_id uuid not null references files(id),
  primary key (incident_id, file_id)
);

create table incident_events (
  id bigserial primary key,
  incident_id uuid not null references incidents(id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid references staff_users(id),
  action text not null,
  note text
);
create trigger incident_events_immutable before update on incident_events for each row execute function forbid_mutation();

-- ───────────────────────── documents ─────────────────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('supplier_invoice','payment_receipt','lab_invoice','stock','maintenance','admin')),
  title text not null,
  supplier text,
  reference_no text,
  amount_myr numeric(12,2),
  doc_date date,
  notes text,
  file_id uuid not null references files(id),
  sha256 text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approver_id uuid references staff_users(id),
  approved_at timestamptz,
  review_comment text,
  drive_file_id text,
  drive_status text not null default 'pending' check (drive_status in ('pending','synced','failed','demo')),
  uploaded_by uuid not null references staff_users(id),
  created_at timestamptz not null default now()
);
create index documents_cat_idx on documents(category, created_at desc);

-- ───────────────────────── SOP & links ─────────────────────────
create table staff_links (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  url text not null,
  description text,
  allowed_roles jsonb not null default '[]'::jsonb, -- empty = all staff
  sort int not null default 0,
  updated_by uuid references staff_users(id),
  updated_at timestamptz not null default now()
);
