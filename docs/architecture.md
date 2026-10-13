# Architecture — Manav Kumar Mishra Portfolio

Phase 1–2 deliverable per `MASTER ENGINEERING PROMPT` §66/§69. This is the
design reference the rest of the build follows. Update it whenever an
architectural decision changes (per §71.10 — decisions are never made silently).

---

## 1. System overview

```text
                     ┌─────────────────────┐
                     │      Browser         │
                     │  (HTML/CSS/vanilla JS)│
                     └─────────┬───────────┘
                               │
                 Firebase Auth │  FastAPI (REST, /api/v1/*)
                               ▼
                     ┌─────────────────────┐
                     │  FastAPI backend     │
                     │  - verifies ID token │
                     │  - checks admin claim│
                     │  - business logic    │
                     └───┬─────────┬───────┘
                         │         │
              service-role│         │ server-side only
                         ▼         ▼
                 ┌───────────┐ ┌───────────┐
                 │ Supabase   │ │ OpenRouter │
                 │ Postgres + │ │ (AI)       │
                 │ Storage    │ │            │
                 └───────────┘ └───────────┘
                         ▲
                         │ scheduled/cached sync
                 ┌───────────┐
                 │ GitHub API │
                 └───────────┘
```

**Identity split (§43):** Firebase owns authentication and the UID. Supabase
owns everything else. The `firebase_uid` column is the bridge; email/name are
mirrored into `profiles` for convenience/display only, never treated as the
source of truth for identity.

**Trust boundary:** the frontend never talks to Supabase or OpenRouter
directly. It only talks to FastAPI. FastAPI holds the Supabase service-role
key and the OpenRouter key server-side; both are invisible to the browser.

---

## 2. Directory structure

```text
manav-portfolio/                  ← repo root AND the frontend Firebase Hosting / Cloud Run project's Root Directory
├── index.html                    ← HOME PAGE — the only page at the true root, so GitHub
│                                     shows it immediately when the repo is opened
├── css/                          ← design tokens + component styles (promoted to root — see note below)
├── js/
│   ├── core/                     cursor.js, transitions.js, motion.js, rtdb.js, auth.js,
│   │                             auth-ui.js, api.js, config.js, include.js (shared by every page)
│   ├── pages/                    one file per page (collection.js, connect.js, admin.js, blog-post.js)
├── shared/                       nav.html + footer.html — fetched at runtime by include.js
├── assets/
│   ├── branding/                 official logo + banner + favicons, used as-is, never redesigned
│   └── profile/  projects/  achievements/  uploads/  blog/   ← admin-upload reference material
├── robots.txt  sitemap.xml  cloud-run.json
├── frontend/
│   └── pages/                    every OTHER page, flat files (not index.html, not shared assets):
│       ├── about.html  projects.html  repositories.html  achievements.html
│       ├── uploads.html  blog.html  blog-post.html  connect.html
│       └── admin/index.html
├── backend/
│   └── app/
│       ├── main.py
│       ├── core/         config.py · security.py (Firebase token verification) · firebase.py
│       ├── api/v1/       one router module per resource (auth, profile, projects,
│       │                 repositories, achievements, uploads, blog, connect,
│       │                 conversations, messages, notifications, reviews, admin, security, tasks)
│       ├── services/
│       │   ├── ai/       service.py · prompts.py · models.py · providers/openrouter.py
│       │   ├── audit.py
│       │   ├── security_monitor.py   (rate limiting + IP blocking)
│       │   ├── github_sync.py
│       │   ├── firebase_rtdb.py      (chat — conversations/messages via the Admin SDK)
│       │   ├── realtime.py           (the /signals/{uid} ping for non-chat notifications)
│       │   ├── checklist.py          (AI checklist generation + regenerate diff/apply)
│       │   └── supabase_client.py
│       ├── models/       Pydantic request/response schemas (incl. tasks.py)
│       └── db/           typed query helpers per table (incl. tasks.py; no conversations.py/messages.py — that's RTDB now)
├── firebase/              database.rules.json + firebase.json — RTDB security rules, deployed via Firebase CLI
├── supabase/migrations/   versioned SQL, applied with `supabase db push`
├── content/               projects.md / achievements.md / uploads.md / blog.md
│                           (seed content the admin can later manage via the DB)
├── docs/                  this file + setup.md, firebase.md, supabase.md,
│                           openrouter.md, security.md, deployment.md
├── instructions.md  CONTINUATION_PROMPT.md
└── .env.example
```

Nothing in `frontend/` or at the root ever imports a framework — plain
HTML/CSS/JS per §1. Nothing in `backend/` holds a secret in source; all
secrets come from environment variables (§40, §55).

**Why `css/`, `js/`, `shared/`, and `assets/` sit at the true repo root
instead of under `frontend/`:** `index.html` lives at the root (deliberately
— see above) while every other page lives one level down, under
`frontend/pages/`. Both need to load the *same* stylesheets/scripts/partials
from one consistent absolute path. Putting those shared folders at the root
— the common ancestor of both `index.html` and `frontend/pages/*.html` —
means `/css/tokens.css`, `/js/core/include.js`, `/assets/branding/logo.png`,
and `/shared/nav.html` resolve identically no matter which page loads them,
with no path-rewriting needed in the HTML itself.

**Navigation is intentionally literal, not "clean," paths:** `shared/nav.html`
links to `/frontend/pages/about.html` etc. — the real nested path — rather
than a clean route like `/about`. This is a deliberate choice (full
rationale in `CONTINUATION_PROMPT.md` Task 1) that takes precedence over
`PRODUCT.md`/`REQUIREMENTS.md`'s clean-route wording for the same reason:
an explicit, repeated project-owner instruction. Two paths stay clean
because they're required verbatim and handled by a `cloud-run.json` rewrite
rather than a real nested file: `/portfolio/admin` (`PRODUCT.md`'s exact
required admin route) and `/blog/<slug>` (a database-driven value, which
isn't a real file on disk at all).

**Firebase Hosting / Cloud Run project setting this layout depends on:** the frontend Firebase Hosting / Cloud Run
project's **Root Directory must be the repository root** (blank/`.`), not
`frontend` — see `instructions.md` §7. If that setting still says
`frontend`, Firebase Hosting / Cloud Run will never see `index.html`, `css/`, `js/`, `shared/`,
or `cloud-run.json`, since they're now outside the directory it's configured
to look in.

---

## 3. Database schema

Full SQL: [`supabase/migrations/0001_init_schema.sql`](../supabase/migrations/0001_init_schema.sql).
Summary of entities and how they relate:

| Table | Purpose | Key relationships |
|---|---|---|
| `profiles` | App-side profile per Firebase UID | PK for everything else that's "owned by a person" |
| `client_requests` | Connect-form submissions | → `profiles`, → `conversations` (1:1 once created) |
| `request_status_history` | Audit trail of status changes | → `client_requests` |
| `projects` | Public portfolio showcase items | none (standalone, admin-managed) |
| `repositories` | Raw GitHub data (cached) | none — keyed by `(source, repo_name)` |
| `achievements` | Certificates/medals/trophies | none |
| `uploads` | Videos/demos with external links | none |
| `blog_posts` | Internally-hosted articles | none |
| `conversations` | One per client request | → `client_requests`, → `conversation_participants` |
| `conversation_participants` | Who's in a conversation | → `conversations` |
| `messages` | Chat messages | → `conversations` |
| `message_drafts` | Unsent per-user drafts | → `conversations`, one row per `(conversation, participant)` |
| `notifications` | Bell notifications | keyed by `recipient_uid` |
| `reviews` | Post-completion star ratings | → `client_requests` (1:1) |
| `audit_logs` | Every important event, site-wide | self-referencing `superseded_by` for note edits |
| `security_events` | Security-only subset | optional → `audit_logs` |
| `rate_limit_blocks` | Temporary IP blocks | keyed by `(ip_address, endpoint)` |
| `media_assets` | What's in Supabase Storage | polymorphic → any content table |

**Why this shape:** `client_requests` keeps the client's original submitted
text verbatim (§19) — the AI overview lives in a separate `ai_overview`
jsonb column so it can never overwrite what the client actually said.
`audit_logs.superseded_by` implements §37's rule that editing a note creates
a *new* event rather than mutating history.

---

## 4. Authentication flow

```text
1. Browser → Firebase Auth SDK → user signs in → Firebase issues an ID token (JWT)
2. Browser attaches the ID token as  Authorization: Bearer <token>  on every
   FastAPI request that needs identity
3. FastAPI dependency `get_current_user`:
     - verifies the token signature against Firebase's public keys
     - checks expiry
     - extracts `uid`, `email`, and custom claims (e.g. `admin: true`)
     - upserts a `profiles` row keyed by that uid if one doesn't exist yet
4. The verified uid is the ONLY identity FastAPI trusts for that request.
   Nothing from the request body (email, "isAdmin" flags, etc.) is trusted.
```

Session expiry, password reset, and email verification are Firebase's job —
FastAPI never re-implements a parallel auth system (§17).

---

## 5. Authorization flow

```text
             verified uid
                  │
        ┌─────────┴─────────┐
        │                   │
  admin custom claim?   ownership check
        │                   │
   FastAPI admin route   FastAPI client route
   (Overview, Clients,   (own client_request,
   Projects CRUD, ...)   own conversation, ...)
```

- **Admin authorization**: a dependency (`require_admin`) checks the
  `admin: true` custom claim on the verified Firebase token — set on Manav's
  account via the Firebase Admin SDK, not stored in Postgres as the source of
  truth. Unauthorized access to `/api/v1/admin/*` returns 403 and is logged
  as a security event (§26–§27, §60).
- **Object-level authorization**: every client-facing endpoint that touches a
  `client_requests`, `conversations`, or `messages` row checks that
  `row.firebase_uid == current_user.uid` before returning or mutating it.
  A client can never read another client's data (§60).
- **Frontend admin checks are cosmetic only** — hiding the admin nav link
  does not substitute for the server-side check.

---

## 6. AI architecture (OpenRouter)

```text
Application code
      │  calls a named task, e.g. ai_service.client_request_overview(...)
      ▼
services/ai/service.py       ← public interface; the rest of the app
                                only ever imports this
      │
      ▼
services/ai/prompts.py       ← one prompt template per task, versioned
      │
      ▼
services/ai/providers/openrouter.py   ← the only file that knows about
                                          OpenRouter's HTTP API / SDK
      │
      ▼
OpenRouter → selected model (configurable via OPENROUTER_MODEL env var)
```

Tasks implemented behind this interface (§71.6):

- `client_request_overview` — structured summary of a Connect submission
- `audit_log_note` — human-readable note for a raw audit event
- `request_categorization` — sanity-check / refine the category a client picked
- `conversation_summary` — optional, for long threads

**Structured output:** each task defines an explicit output schema (e.g.
`{summary, project_type, key_requirements, deadline, budget, important_notes}`)
and the response is validated before being stored — never trusted as-is (§71.7).

**Failure handling (§71.5):** if OpenRouter errors or times out, the calling
code:
1. still saves the original record (the client request, the audit event) —
   this always succeeds independently of AI
2. sets `ai_status = 'failed'` (or leaves `'pending'`)
3. never blocks the response to the user
4. can be retried later (a small background retry sweep, or a manual
   "regenerate" button in admin)

Swapping the model later is a one-line env var change (`OPENROUTER_MODEL`);
swapping the *provider* means writing one new file under `providers/` — no
other code changes.

---

## 7. API structure

Versioned, one router per resource, mounted under `/api/v1`:

```text
/api/v1/auth            session bootstrap / profile upsert on first login
/api/v1/profile         get/update the current user's profile
/api/v1/projects        public GET (published only); admin CRUD
/api/v1/repositories    public GET (visible only); admin CRUD + manual GitHub sync trigger
/api/v1/achievements     public GET (published only); admin CRUD
/api/v1/uploads         public GET (published only); admin CRUD
/api/v1/blog            public GET (published only) + /blog/<slug>; admin CRUD
/api/v1/connect         submit a client request (auth required)
/api/v1/conversations   list/get the current user's conversation(s)
/api/v1/messages        send/list messages + drafts, scoped to owned conversations
/api/v1/notifications   list/mark-read, scoped to the current user
/api/v1/reviews         submit a review (only for completed, owned requests)
/api/v1/admin           overview, clients table, per-resource admin views
/api/v1/security        security-view data (admin only)
```

Every mutating route runs through: token verification → (admin or ownership
check) → input validation (Pydantic) → service layer → audit log write.

---

## 8. Security architecture

- **Rate limiting & IP blocking** (§39): a `security_monitor` service tracks
  request volume per `(ip, endpoint)` in `rate_limit_blocks`. Thresholds are
  endpoint-specific and configurable, so a shared office/campus IP hitting
  the public blog isn't treated the same as one hammering `/auth/login`.
  Blocks are temporary and escalate on repeat violations — never permanent
  by default.
- **Headers**: CSP, HSTS, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` set globally via FastAPI middleware.
- **Input validation**: Pydantic schemas on every request body; parameterized
  queries only (Supabase client library handles this); upload validation on
  extension + MIME type + size, never trusting the client-supplied filename.
- **Supabase**: RLS enabled on every table as defense-in-depth (see the
  migration file); the service-role key lives only in backend environment
  variables, never sent to the browser.
- **Audit + security logging**: built into the service layer itself (§61),
  not something each route author has to remember — a shared
  `audit.log(...)` call is invoked from inside the CRUD service functions.

Full detail: `docs/security.md` (to be written alongside the security phase).

---

## 9. Public route map

```text
/                — Home
/about           — About Me
/projects        — Projects  (filters: ALL · WEBSITES · PC APPS · MOBILE APPS · ROBOTICS)
/repositories    — Repositories
/achievements    — Achievements (filters: ALL · DEVELOPMENT · HACKATHON · ROBOTICS · GAMING · EDUCATION)
/uploads         — Uploads (filters: ALL · PROJECT DEMO · TUTORIAL · EXPERIMENT · SHOWCASE · OTHER)
/blog            — Blog (filters: ALL · DEVELOPMENT · AI · ROBOTICS · PROJECTS · TUTORIALS · OTHER)
/blog/<slug>     — Individual post
/connect         — Connect (auth-gated form + chat + socials)
```

## 10. Admin route map

```text
/portfolio/admin                     — Overview (command center)
/portfolio/admin (Clients tab)       — Clients table → client detail view
/portfolio/admin (Projects tab)      — Projects table → editor
/portfolio/admin (Repositories tab)  — Repositories table → GitHub sync + curation
/portfolio/admin (Achievements tab)  — Achievements table → editor
/portfolio/admin (Uploads tab)       — Uploads table → editor
/portfolio/admin (Blog tab)          — Blog table → editor
/portfolio/admin (Audit Log tab)     — full audit log, filterable
/portfolio/admin (Security View tab) — security events only, filterable
```

Server-side rejection for all of the above per §26–§27 — no admin UI or data
is ever rendered/returned to a non-admin, regardless of what the URL is.

---

## 11. Design system (summary — full tokens live in `frontend/css/`)

- **Palette**: black/near-black base, white for readable UI/type, red and
  blue as *lighting*, not blocks of color.
- **Typography**: one display face for cinematic headlines, one workhorse
  face for body text; a small, consistent size/spacing scale.
- **Components**: buttons, cards, tables (real `<table>` for admin, not
  cards), modals, side drawers, the notification bell, the custom cursor.
- **Cursor**: small white dot → expands/morphs with a red/blue glow on
  hover of interactive elements; disabled entirely on touch devices.

## 12. Animation / motion system (summary)

- Page transitions between MPA routes: fade/slide, `prefers-reduced-motion`
  respected, degrades to instant navigation with JS disabled.
- Background atmosphere: subtle particles/orbs/gradient, mouse-reactive,
  capped so it never competes with reading the content.
- Reveal-on-scroll for content sections; no animation is ever the *only*
  way to reach something (keyboard/no-JS always works, §47).

---

## 13. Hosting & deployment

- **Frontend**: static HTML/CSS/JS, source on GitHub, deployed on Firebase Hosting / Cloud Run.
- **Backend**: FastAPI, also on Firebase Hosting / Cloud Run — as **serverless functions**, not a
  long-running process. This changes a few things from a "traditional"
  FastAPI deployment:
  - **No in-process background workers.** Anything meant to run
    periodically (the AI retry sweep for failed `ai_status`, GitHub repo
    sync/cache refresh, expiring old `rate_limit_blocks` rows) can't just be
    a background thread inside the app — it has to be a **Firebase Hosting / Cloud Run Cron Job**
    that hits a small internal endpoint on a schedule, or a Supabase
    `pg_cron` job running inside Postgres itself.
  - **No persistent WebSocket connections.** A serverless function can't
    hold a socket open across requests. For live chat delivery and
    notification badges, the plan is to lean on **Supabase Realtime**
    (Postgres change subscriptions) from the frontend instead of a custom
    WebSocket server — the browser subscribes directly to the `messages`
    and `notifications` tables (via Supabase's client library, using a
    scoped anon key + RLS) for live updates, while all writes still go
    through FastAPI so authorization/audit logging stay server-enforced.
  - **Cold starts** matter more than on a VM — keep function bundles small
    per route rather than one giant FastAPI app instance where avoidable.
- **Database**: Supabase Postgres (already provisioned).
- **Auth**: Firebase (already provisioned).
- **AI**: OpenRouter.

## 13b. Firebase RTDB owns chat; Supabase owns everything structured (architecture change)

Per an explicit architecture decision, **Supabase Realtime is never used**,
and chat is no longer split between Supabase + a signal — RTDB now owns
the whole live-communication layer:

```text
Firebase                           Supabase
├── Authentication                 ├── PostgreSQL
└── Realtime Database                  ├── profiles, client_requests, tasks
    ├── /conversations/{id}            ├── projects, repositories, achievements,
    ├── /messages/{convId}/{msgId}      uploads, blog, reviews
    ├── /drafts/{convId}/{uid}         ├── notifications (durable history)
    ├── /typing/{convId}/{uid}         ├── audit_logs, security_events,
    ├── /presence/{uid}                   rate_limit_blocks
    ├── /unread/{uid}/{convId}     └── Storage (images/media)
    └── /signals/{uid}
```

**Write path (conversations + messages): still through FastAPI.** The
client never writes `/conversations` or `/messages` directly — RTDB rules
set `.write: false` on both paths, same as `.write false` for direct
Supabase table access (defense in depth; the real enforcement is server
authorization). `services/firebase_rtdb.py` is the only thing that writes
there, via the Admin SDK (bypasses rules, same pattern as the Supabase
service-role key bypassing RLS). This is deliberate, not a half-migration:
rate limiting, ownership checks, and audit logging all still have to happen
somewhere, and that's FastAPI — moving the *storage* to RTDB doesn't mean
giving up the *authorization* that already existed. `POST /api/v1/messages/{id}`
still validates, rate-limits, and audit-logs exactly as before; it just
calls `firebase_rtdb.send_message()` instead of a Supabase insert now.

**Read path: direct.** The browser listens to `/conversations/{id}` and
`/messages/{id}` with the Firebase JS SDK for instant delivery — that's
the entire point of this change. Rules restrict reads to conversation
participants (checked against the `participants` map stored on the
conversation node at creation time).

**Written directly by the client, no FastAPI round-trip**: drafts, typing
indicators, presence. These are low-stakes, high-frequency (per-keystroke
or per-connection), and routing them through an HTTP call every time would
make chat feel laggy — exactly what RTDB exists to avoid. Rules enforce
`auth.uid === $uid` plus conversation membership for drafts/typing, and
just `auth.uid === $uid` for presence (read is open to any signed-in user —
online/offline is low-sensitivity). `unread/{uid}/{convId}` can only be
**zeroed** by its owner (`newData.val() === 0`) — a client can clear their
own unread count but can never increment it or touch anyone else's,
closing the "manipulate unread state" concern directly in the rules rather
than relying on the app layer alone.

**Notifications stay split, as specified**: a durable Supabase
`notifications` row (history, read state, shown in the bell's dropdown)
plus a live `/signals/{uid}` ping (timestamp + event type only) so an open
tab refreshes instantly. For chat itself the message node IS the live
signal — a `/signals` ping on `new_message` only matters to a tab that
*isn't* already listening to that conversation's `/messages/{id}`.

Full rules: [`firebase/database.rules.json`](../firebase/database.rules.json).
Setup: `docs/firebase.md`. The previous signal-only design (and why RTDB
wasn't used for message content at first) is kept in git history, not
repeated here — this section is the current, authoritative design.

## 13c. Checklist / completion system (§17-35 of the architecture-change doc)

A client request (and, once converted, a project) carries an AI-generated,
admin-editable task checklist. Completion is **computed from task state**,
never asserted by the AI:

```text
completion % = (Σ weight of completed tasks) / (Σ weight of active tasks) × 100
```

"Active" excludes `skipped` tasks (an obsoleted AI suggestion shouldn't drag
the percentage down) but includes `blocked` ones (the work is still owed).
`db/tasks.py::completion()` is the only place this number is computed —
never cached, never stored, so it can't go stale.

**AI vs admin (§22)**: `services/ai/service.py::generate_checklist()` and
`regenerate_checklist()` only ever produce `source='ai'` task *suggestions*.
Nothing in the AI path can mark a task `completed` or set a percentage —
that's `db/tasks.py` reacting to real status changes the admin makes.

**Regeneration never silently replaces work (§29)**: `POST
.../checklist/regenerate-preview` writes nothing — it diffs the AI's fresh
suggestions against the current checklist and returns `to_add` / `to_obsolete`
/ `to_keep` (completed or manually-edited tasks are always `to_keep`,
unconditionally). Only `POST .../checklist/regenerate-apply`, with the
admin's explicitly confirmed subset, touches the database — and even then
`to_obsolete` tasks are flagged `skipped`, never deleted, so history
survives.

**Request → project conversion (§23)**: `POST
/admin/clients/{id}/convert-to-project` creates the project and **moves**
(`db/tasks.py::reparent()`) the existing checklist over by updating its
`owner_type`/`owner_id` — never duplicates it.

**Client-safe view (§34)**: `GET /api/v1/requests/{id}/progress` returns
exactly three fields — `completion_percent`, `current_stage` (derived from
which task is in progress, never an internal blocked-reason or admin note),
and `next`. Everything else about the checklist (titles, descriptions,
blockers, who changed what) is admin-only.

**Public exposure is opt-in per project (§35)**: `projects.show_progress_publicly`
defaults to `false` — a published project card never shows internal
completion unless that flag is explicitly turned on for it.

## 14. Secrets handling — GitHub token included

Every secret in this project (`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`,
`FIREBASE_SERVICE_ACCOUNT_JSON`, and this includes the **GitHub token**)
follows the same rule from §40/§55: it lives only as a **Firebase Hosting / Cloud Run
Environment Variable on the backend project**, read via `os.environ` inside
`services/github_sync.py`, and is never written into any frontend file,
never committed to the repo, and never appears in browser-visible code —
the browser only ever calls `/api/v1/repositories`, which the backend
populates using the token server-side. This is true even though Firebase Hosting / Cloud Run
makes it easy to *also* expose a variable to the frontend build (anything
prefixed `NEXT_PUBLIC_`-style or added to the frontend project's env) — the
GitHub token specifically should only ever be added to the **backend**
project's environment variables, scoped to server-side use.

---

## 15. Implementation phases (tracking §66)

- [x] Phase 1 — Analyze
- [x] Phase 2 — Architecture (this document + schema)
- [x] Phase 3 — UI system ([`design-system.md`](design-system.md), `frontend/css/`)
- [x] Phase 4 — Public site: Home, About, Projects, Repositories, Achievements, Uploads, Blog (+ post page), Connect
- [x] Phase 5 — Firebase auth wiring (`js/core/auth.js`, `auth-ui.js`, Connect gate modal)
- [x] Phase 6 — FastAPI services + authorization (40 routes, `backend/tests` covers authz)
- [x] Phase 7 — Supabase migrations 0001-0003 written (**not yet applied to your project**)
- [x] Phase 8 — Requests, chat + drafts (now RTDB — see §13b), notifications, statuses, reviews, AI checklist/completion (§13c)
- [x] Phase 9 — Admin panel (all nine tabs)
- [x] Phase 10 — OpenRouter AI service layer
- [x] Phase 11 — Security: rate limiting/IP blocks, headers/CSP, audit + security events, validated uploads
- [ ] Phase 12 — QA against live services (needs your keys), CAPTCHA, email-verification gate, real project descriptions

Everything above is written and unit-tested where possible (backend authz tests pass with mocked
Firebase/Supabase), but it has **not been run against real Firebase/Supabase/OpenRouter/GitHub** —
expect a debugging pass once credentials are in. See `docs/security.md` -> Known gaps.
