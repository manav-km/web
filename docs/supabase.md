# Supabase (application data + storage)

## Keys — what's safe
- `SUPABASE_URL` — not secret.
- `SUPABASE_SERVICE_ROLE_KEY` — **SECRET**. Bypasses RLS. Backend env var only (Firebase Hosting / Cloud Run), never in the frontend, never in git.
- The anon key is **not used** by this app (all data goes through FastAPI), so it isn't needed.

Where: Dashboard -> Project Settings -> API. Region: pick the one nearest your audience (for India, Mumbai `ap-south-1` if offered, otherwise Singapore).

## What moved out (architecture change)

Conversations and messages are **no longer Supabase tables** — chat lives
in Firebase RTDB now (see `docs/architecture.md` §13b, `docs/firebase.md`).
`client_requests.rtdb_conversation_id` is just the RTDB key; there's no FK
for it since the conversation itself isn't in Postgres anymore.

## What's new: the `tasks` table

The AI checklist/completion system (§13c) lives in one polymorphic `tasks`
table (`owner_type` = `request` or `project`, `owner_id` = that row's id) —
not two near-identical tables, since a task doesn't change shape when a
request becomes a project, only its owner.

## Applying the schema
Dashboard -> SQL Editor -> paste and run, in order:
1. `0001_init_schema.sql` — tables, enums, triggers, RLS, the atomic rate-limit function.
2. `0002_storage_buckets.sql` — four image buckets (public-read, backend-write only, 2 MB, PNG/JPEG/WebP).
3. `0003_seed_initial_content.sql` — your six projects (as drafts) and repos.
Future changes = new numbered files, never edits to applied ones.

## RLS in plain words
Row Level Security makes Postgres itself refuse rows a role shouldn't see. Here: public content tables allow `SELECT` only on published rows; every private table (requests, messages, reviews, audit, security, profiles) has a "deny all" policy for direct access. The backend uses the service-role key (bypasses RLS) and enforces authorization itself — RLS is the safety net if a key ever leaks into the wrong place.

## Storage
Buckets are public-read because the images are shown on the public site, but there are **no write policies**: only the backend can authorise an upload (`/api/v1/admin/media/upload-url` validates type and size and generates the filename).

## Realtime
Not used. Chat/notifications poll (10 s while the chat is open, 60 s for the bell) — simple, secure, and fine at this scale. Adding Realtime later is possible but needs a way to give the browser a Supabase-scoped token from a Firebase login; poll first.
