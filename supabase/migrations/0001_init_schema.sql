-- ============================================================================
-- 0001_init_schema.sql
-- Initial schema for Manav Kumar Mishra's portfolio (Supabase Postgres)
--
-- Firebase is authoritative for identity/auth. Every table that belongs to a
-- person references them by `firebase_uid text`, never by duplicating auth
-- data (email/password) into Postgres.
--
-- Apply with: supabase db push   (or paste into SQL Editor for the first run)
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------- Enums ----------
create type content_status as enum ('draft', 'published', 'archived');
create type request_category as enum ('website', 'pc_app', 'mobile_app', 'ai_automation', 'robotics', 'other');
create type request_status as enum ('pending', 'in_discussion', 'in_progress', 'completed', 'declined');
create type ai_field_status as enum ('pending', 'completed', 'failed', 'retrying');
create type severity_level as enum ('Low', 'Alert', 'Critical');
create type project_category as enum ('websites', 'pc_apps', 'mobile_apps', 'robotics');
create type achievement_category as enum ('development', 'hackathon', 'robotics', 'gaming', 'education');
create type upload_category as enum ('project_demo', 'tutorial', 'experiment', 'showcase', 'other');
create type blog_category as enum ('development', 'ai', 'robotics', 'projects', 'tutorials', 'other');
create type github_source as enum ('manav-km', 'trd-dnmx');
create type task_status as enum ('todo', 'in_progress', 'completed', 'blocked', 'skipped');
create type task_category as enum (
  'planning', 'design', 'frontend', 'backend', 'database', 'authentication',
  'api', 'ai', 'automation', 'integration', 'testing', 'security', 'deployment', 'documentation', 'other'
);
create type task_source as enum ('ai', 'admin');
create type task_owner_type as enum ('request', 'project');
create type project_dev_status as enum ('planning', 'in_progress', 'review', 'completed', 'archived');

-- ============================================================================
-- IDENTITY BRIDGE
-- ============================================================================

-- One row per authenticated visitor. Populated on first sign-in.
-- NOT the source of truth for auth (Firebase is) — this is app-side profile data.
create table profiles (
  firebase_uid    text primary key,
  full_name       text,
  email           text,               -- mirrored from Firebase token for convenience/display only
  phone           text,
  country         text,
  profession      text,
  business        text,
  is_admin        boolean not null default false,   -- convenience flag only; the REAL check is the Firebase custom claim, verified server-side
  avatar_url      text,               -- profile picture (Supabase Storage, 'profile-pictures' bucket)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- CLIENT REQUESTS (Connect form submissions)
-- ============================================================================

create table client_requests (
  id                  uuid primary key default gen_random_uuid(),
  firebase_uid        text not null references profiles(firebase_uid) on delete cascade,

  -- snapshot of the submitted form (kept even if the profile changes later)
  full_name           text not null,
  email               text not null,
  phone               text not null,
  country             text not null,
  profession          text not null,
  business            text not null,
  category            request_category not null,
  deadline            date not null,
  budget              text not null,          -- free text ("₹20,000–₹40,000", "flexible", etc.)
  project_description text not null,          -- the ORIGINAL client text — never overwritten by AI

  status              request_status not null default 'pending',

  ai_overview         jsonb,                  -- structured AI output, see docs/architecture.md → AI Architecture
  ai_status           ai_field_status not null default 'pending',

  checklist_status    ai_field_status not null default 'pending',  -- AI checklist generation, separate from ai_overview above
  rtdb_conversation_id text,                   -- Firebase RTDB key (see "CHAT" note above) — not a Postgres FK

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on client_requests (firebase_uid);
create index on client_requests (status);

create table request_status_history (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references client_requests(id) on delete cascade,
  old_status   request_status,
  new_status   request_status not null,
  changed_by   text not null,          -- firebase_uid of admin (or 'system')
  note         text,
  changed_at   timestamptz not null default now()
);

-- ============================================================================
-- PROJECTS  (polished portfolio showcases)
-- ============================================================================

create table projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,
  name          text not null,
  description   text not null,
  category      project_category not null,
  logo_url      text,
  github_url    text,
  website_url   text,
  status        content_status not null default 'draft',    -- PUBLIC visibility: draft/published/archived
  dev_status    project_dev_status not null default 'planning',  -- INTERNAL progress stage — separate axis, never conflated with `status` (§24)
  show_progress_publicly boolean not null default false,     -- §35 — public cards never show internal completion unless explicitly turned on
  source_request_id uuid references client_requests(id) on delete set null,  -- links a project back to the request it grew out of (§23)
  deadline      date,                                          -- §24
  completed_at  timestamptz,                                   -- §24 — stamped automatically when dev_status -> 'completed', see trigger below
  sort_order    int not null default 0,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on projects (status, category);

-- ============================================================================
-- REPOSITORIES  (raw GitHub data, cached/synced — separate from Projects)
-- ============================================================================

create table repositories (
  id                uuid primary key default gen_random_uuid(),
  source            github_source not null,       -- 'manav-km' or 'trd-dnmx'
  repo_name         text not null,
  description       text,
  github_url        text not null,
  languages         jsonb,                         -- e.g. [{"name":"JavaScript","percent":72}, ...]
  stars             int not null default 0,
  forks             int not null default 0,
  github_updated_at timestamptz,                   -- from GitHub API
  published_on      timestamptz not null default now(),  -- when it appeared on THIS portfolio
  is_visible        boolean not null default true,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now(),
  unique (source, repo_name)
);

-- ============================================================================
-- ACHIEVEMENTS
-- ============================================================================

create table achievements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      achievement_category not null,
  place         text,                 -- e.g. "1st place", "Finalist"
  experience    text,                 -- longer reflective text
  event_date    date,
  image_url     text,                 -- Supabase Storage path (private bucket, signed URL on read)
  status        content_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on achievements (status, category);

-- ============================================================================
-- UPLOADS
-- ============================================================================

create table uploads (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  category       upload_category not null,
  description    text,
  thumbnail_url  text,
  external_link  text not null,
  uploaded_on    timestamptz not null default now(),   -- real timestamp; format on frontend as DD/MM/YYYY | Day
  status         content_status not null default 'draft',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on uploads (status, category);

-- ============================================================================
-- BLOG  (hosted internally — no external link field)
-- ============================================================================

create table blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  category      blog_category not null,
  excerpt       text,
  content       text not null,        -- markdown or HTML, rendered by the frontend
  cover_image_url text,
  status        content_status not null default 'draft',
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on blog_posts (status, category);

-- ============================================================================
-- CHAT — lives in Firebase Realtime Database, NOT here.
--
-- Conversations, messages, drafts, typing indicators and presence are all
-- in RTDB (see firebase/database.rules.json and docs/firebase.md) so the
-- client/admin messenger gets instant delivery without round-tripping
-- through Postgres. client_requests.rtdb_conversation_id (below) is just
-- the RTDB key — there is nothing to join against here, so no FK.
-- Everything else the client ever contacts stays in Supabase (§43).
-- ============================================================================


-- ============================================================================
-- TASKS — the AI-generated, admin-editable checklist behind completion % (§17-32).
--
-- Polymorphic owner (a request before it becomes a project, or the project
-- itself once linked — see projects.source_request_id above) rather than two
-- near-identical tables, since a task is a task regardless of which side of
-- that link it's currently attached to.
-- ============================================================================

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  owner_type        task_owner_type not null,
  owner_id          uuid not null,               -- client_requests.id or projects.id, per owner_type — no FK (polymorphic)
  title             text not null,
  description       text,
  category          task_category not null default 'other',
  weight            numeric not null default 5 check (weight > 0),  -- relative effort/importance, admin-editable (§20)
  status            task_status not null default 'todo',
  sort_order        int not null default 0,
  blocked_reason    text,                          -- required context when status = 'blocked' (§27)
  depends_on        uuid[] not null default '{}',  -- other tasks.id this one waits on (§28) — soft reference, no FK on array elements
  source            task_source not null default 'ai',
  is_manual_override boolean not null default false,  -- true once an admin edits an AI task — protects it from being silently replaced on regeneration (§29)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index on tasks (owner_type, owner_id, sort_order);

create or replace function set_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
  elsif new.status is distinct from 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_tasks_updated_at before update on tasks for each row execute function set_tasks_updated_at();

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_uid text not null,
  type          text not null,        -- 'new_message' | 'request_status' | 'review_available' | ...
  payload       jsonb not null default '{}',
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index on notifications (recipient_uid, is_read);

-- ============================================================================
-- REVIEWS
-- ============================================================================

create table reviews (
  id                      uuid primary key default gen_random_uuid(),
  request_id              uuid not null references client_requests(id) on delete cascade,
  client_uid              text not null references profiles(firebase_uid) on delete cascade,
  overall_rating          smallint not null check (overall_rating between 1 and 5),
  professionalism_rating  smallint not null check (professionalism_rating between 1 and 5),
  satisfaction_rating     smallint not null check (satisfaction_rating between 1 and 5),
  expectations_rating     smallint not null check (expectations_rating between 1 and 5),
  usability_rating        smallint not null check (usability_rating between 1 and 5),
  pricing_rating          smallint not null check (pricing_rating between 1 and 5),
  sufficiency_rating      smallint not null check (sufficiency_rating between 1 and 5),
  note                    text,
  created_at              timestamptz not null default now(),
  unique (request_id)
);

-- ============================================================================
-- AUDIT LOG  (everything important)
-- ============================================================================

create table audit_logs (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  category         text not null,        -- 'auth' | 'content' | 'client' | 'message' | 'admin' | 'security' | 'system'
  action           text not null,        -- short machine-readable action code
  performer_uid    text,                 -- null for anonymous/system events
  performer_name   text,
  ip_address       text not null,        -- backend-observed public IP; never store 192.168.x.x
  note             text,                 -- AI-generated by default, admin-editable
  severity         severity_level not null default 'Low',
  metadata         jsonb not null default '{}',
  superseded_by    uuid references audit_logs(id),  -- set on the OLD row when an admin edits its note
  created_at       timestamptz not null default now()
);

create index on audit_logs (occurred_at desc);
create index on audit_logs (category, severity);
create index on audit_logs (performer_uid);

-- ============================================================================
-- SECURITY EVENTS  (security-only subset; may also have a matching audit_logs row)
-- ============================================================================

create table security_events (
  id                 uuid primary key default gen_random_uuid(),
  occurred_at        timestamptz not null default now(),
  action             text not null,     -- 'ip_block' | 'rate_limit' | 'failed_login' | 'unauthorized_admin_access' | ...
  category           text not null,     -- 'authentication' | 'authorization' | 'rate_limit' | 'ip_block' | 'suspicious_request' | 'admin_access' | 'account_security' | 'system_security'
  ip_address         text not null,
  performer_uid      text,
  source             text,              -- e.g. endpoint path
  reason             text,
  severity           severity_level not null default 'Low',
  related_audit_log  uuid references audit_logs(id),
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now()
);

create index on security_events (occurred_at desc);
create index on security_events (severity);
create index on security_events (ip_address);

-- ============================================================================
-- RATE LIMITING / TEMPORARY IP BLOCKS
-- ============================================================================

create table rate_limit_blocks (
  id               uuid primary key default gen_random_uuid(),
  ip_address       text not null,
  endpoint         text not null,       -- e.g. '/api/v1/connect', '/api/v1/auth/login'
  violation_count  int not null default 1,
  window_start     timestamptz not null default now(),
  blocked_until    timestamptz,
  created_at       timestamptz not null default now(),
  unique (ip_address, endpoint)
);

create index on rate_limit_blocks (ip_address, endpoint);

-- Atomic check-and-increment: called once per incoming request on a
-- rate-limited endpoint. A plain select-then-update from the app would
-- race under concurrent requests from the same IP; this single upsert
-- statement does the whole decision inside one Postgres round trip.
create or replace function check_and_increment_rate_limit(
  p_ip text, p_endpoint text, p_window_seconds int, p_max_requests int, p_block_seconds int
) returns table(blocked boolean, blocked_until timestamptz) as $$
begin
  return query
  insert into rate_limit_blocks (ip_address, endpoint, violation_count, window_start, blocked_until)
  values (p_ip, p_endpoint, 1, now(), null)
  on conflict (ip_address, endpoint) do update set
    violation_count = case
      when rate_limit_blocks.blocked_until is not null and rate_limit_blocks.blocked_until > now()
        then rate_limit_blocks.violation_count
      when rate_limit_blocks.window_start < now() - (p_window_seconds || ' seconds')::interval
        then 1
      else rate_limit_blocks.violation_count + 1
    end,
    window_start = case
      when rate_limit_blocks.blocked_until is not null and rate_limit_blocks.blocked_until > now()
        then rate_limit_blocks.window_start
      when rate_limit_blocks.window_start < now() - (p_window_seconds || ' seconds')::interval
        then now()
      else rate_limit_blocks.window_start
    end,
    blocked_until = case
      when rate_limit_blocks.blocked_until is not null and rate_limit_blocks.blocked_until > now()
        then rate_limit_blocks.blocked_until
      when rate_limit_blocks.window_start >= now() - (p_window_seconds || ' seconds')::interval
           and rate_limit_blocks.violation_count + 1 > p_max_requests
        then now() + (p_block_seconds || ' seconds')::interval
      else null
    end
  returning (blocked_until is not null and blocked_until > now()), blocked_until;
end;
$$ language plpgsql;

-- ============================================================================
-- MEDIA METADATA  (tracks what's in Supabase Storage buckets)
-- ============================================================================

create table media_assets (
  id                  uuid primary key default gen_random_uuid(),
  bucket              text not null,          -- 'project-logos' | 'achievement-images' | 'upload-thumbnails' | 'blog-images' | 'branding'
  storage_path        text not null,
  content_type        text,
  size_bytes          bigint,
  uploaded_by         text,                    -- firebase_uid, 'admin' for site-owner uploads
  related_entity_type text,                    -- 'project' | 'achievement' | 'upload' | 'blog_post'
  related_entity_id   uuid,
  created_at          timestamptz not null default now()
);

-- ============================================================================
-- updated_at auto-touch trigger (applied to the tables that track it)
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at        before update on profiles        for each row execute function set_updated_at();
create trigger trg_client_requests_updated_at  before update on client_requests for each row execute function set_updated_at();
create trigger trg_projects_updated_at         before update on projects        for each row execute function set_updated_at();

create or replace function set_project_completed_at()
returns trigger as $$
begin
  if new.dev_status = 'completed' and old.dev_status is distinct from 'completed' then
    new.completed_at = now();
  elsif new.dev_status is distinct from 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_completed_at before update on projects for each row execute function set_project_completed_at();
create trigger trg_achievements_updated_at     before update on achievements    for each row execute function set_updated_at();
create trigger trg_uploads_updated_at          before update on uploads         for each row execute function set_updated_at();
create trigger trg_blog_posts_updated_at       before update on blog_posts      for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- Pattern used throughout: RLS protects DIRECT client access (if the frontend
-- ever queries Supabase directly with a user's JWT). The FastAPI backend
-- itself connects with the service-role key and bypasses RLS by design —
-- so the backend's own authorization checks (verified Firebase UID, admin
-- claim, ownership checks) remain mandatory. RLS is defense-in-depth, not a
-- replacement for backend checks.
-- ============================================================================

alter table profiles              enable row level security;
alter table client_requests       enable row level security;
alter table tasks                 enable row level security;
alter table notifications         enable row level security;
alter table reviews               enable row level security;
alter table audit_logs            enable row level security;
alter table security_events       enable row level security;
alter table rate_limit_blocks     enable row level security;

-- Public content tables: readable by anyone for published rows only.
alter table projects      enable row level security;
alter table repositories  enable row level security;
alter table achievements  enable row level security;
alter table uploads       enable row level security;
alter table blog_posts    enable row level security;

create policy "public can read published projects"
  on projects for select using (status = 'published');

create policy "public can read visible repositories"
  on repositories for select using (is_visible = true);

create policy "public can read published achievements"
  on achievements for select using (status = 'published');

create policy "public can read published uploads"
  on uploads for select using (status = 'published');

create policy "public can read published blog posts"
  on blog_posts for select using (status = 'published');

-- Client-owned rows: a client may only see their own request/tasks/reviews.
-- auth.jwt() ->> 'sub' is only meaningful if Supabase Auth is used directly; since this
-- project uses Firebase Auth, direct-from-browser Supabase access is NOT used for these
-- tables in the current architecture — the backend mediates everything. These policies
-- exist as a safety net in case that ever changes, and default to "deny all" for anon/authenticated
-- Supabase roles, forcing access through the service-role backend. Chat itself lives in
-- RTDB, whose own rules (firebase/database.rules.json) are the real access control for it.

create policy "deny direct client access to client_requests"
  on client_requests for all using (false);

create policy "deny direct client access to tasks"
  on tasks for all using (false);

create policy "deny direct client access to reviews"
  on reviews for all using (false);

create policy "deny direct client access to audit_logs"
  on audit_logs for all using (false);

create policy "deny direct client access to security_events"
  on security_events for all using (false);

-- profiles: a client may read/update only their own profile row IF ever queried
-- directly (not the current architecture, but kept safe by default).
create policy "deny direct client access to profiles"
  on profiles for all using (false);
