# Manav Kumar Mishra — Portfolio

A cinematic, motion-heavy personal developer portfolio: multi-page vanilla
HTML/CSS/JS frontend, FastAPI backend, Firebase Authentication, Supabase
Postgres + Storage, and an OpenRouter-powered AI layer for admin-side
summaries and notes.

This is not a template — see `docs/architecture.md` for the full design.

## Status

All phases are written (see the checklist at the bottom of `docs/architecture.md`). Not yet run against
live services. Start with `docs/setup.md`. Deployment: `docs/deployment.md`.

## Layout

```text
index.html   home page — alone at the repo root on purpose (see docs/architecture.md §2)
css/ js/ shared/   styles, scripts, and the nav/footer partials every page loads
assets/      branding, profile, project/achievement/upload/blog media
frontend/    every OTHER page, flat files under frontend/pages/ (about.html, connect.html, admin/, ...)
backend/     FastAPI app (app/api, app/services, app/models, app/db)
supabase/    versioned SQL migrations
firebase/    Realtime Database security rules
content/     seed content for initial projects/achievements/uploads/blog
docs/        architecture + setup guides (Firebase, Supabase, OpenRouter, security, deployment)
```

See `docs/architecture.md` §2 for exactly why the layout is split this way,
and `CONTINUATION_PROMPT.md` for the full reasoning history.

## Setup

`docs/setup.md` (local), `docs/firebase.md`, `docs/supabase.md`, `docs/openrouter.md`, `docs/security.md`, `docs/deployment.md`.

## Branding

The logo and banner in `assets/branding/` are the official, supplied assets
and are used exactly as provided — never redesigned or reinterpreted.
