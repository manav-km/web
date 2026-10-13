# Local setup

## Prerequisites
Python 3.11+, Git, a Firebase project, a Supabase project, an OpenRouter key. (Node is not needed.)

## 1. Environment
```bash
cp .env.example backend/.env     # then fill in real values — .env is git-ignored
```
Where each value comes from: see `docs/firebase.md`, `docs/supabase.md`, `docs/openrouter.md`.

## 2. Database
Run the three files in `supabase/migrations/` in order (Supabase Dashboard -> SQL Editor, or `supabase db push`).
Details and what each one does: `docs/supabase.md`.

## 3. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Check: open http://localhost:8000/api/v1/health -> `{"ok": true}`.
Run the tests: `pip install pytest && pytest tests` (they mock Firebase/Supabase — no credentials needed).

## 4. Frontend
1. Edit `frontend/js/core/config.js`: set `API_BASE` (e.g. `http://localhost:8000/api/v1`) and paste your Firebase **web** config (public values).
2. Serve the folder with clean-URL support, e.g. `npx cloud-run dev` inside `frontend/` (or any static server; note `/` maps to `pages/index.html` via `cloud-run.json` rewrites).
3. Set `FRONTEND_ORIGIN` in `backend/.env` to the exact origin you serve from (CORS is locked to it).

## 5. Make yourself admin
Sign in once on the site, copy your UID from Firebase Console -> Authentication -> Users, then:
```bash
cd backend && python scripts/set_admin_claim.py <uid>
```
Sign out and in again. `/portfolio/admin` now works for you and only you.

## Common errors
- **CORS error in browser** -> `FRONTEND_ORIGIN` doesn't match the page origin exactly.
- **401 on every call** -> Firebase project IDs differ between frontend config and backend `FIREBASE_PROJECT_ID`.
- **Admin redirects to home** -> the claim wasn't set, or you didn't sign out/in afterwards.
- **`Settings` validation error at startup** -> a required variable is missing in `backend/.env`.
