# Deployment (Firebase Hosting / Cloud Run x2, both from this GitHub repo)

## Frontend project
Firebase Hosting / Cloud Run -> New Project -> import the repo -> **Root Directory: `frontend`** -> Framework: Other. No build command. Before deploying, edit `js/core/config.js` (API URL + Firebase web config) and the `connect-src` domain in `cloud-run.json`.

## Backend project
A second Firebase Hosting / Cloud Run project, same repo, **Root Directory: `backend`**. Add every variable from `.env.example` under Settings -> Environment Variables (Production). Set `CRON_SECRET` — Firebase Hosting / Cloud Run Cron then authenticates automatically; `backend/cloud-run.json` schedules GitHub sync (daily), AI retry (hourly) and cleanup (daily). Give it a domain such as `api.yourdomain.com` and put that in the frontend `config.js`/CSP and in `FRONTEND_ORIGIN` on the backend.
Note: Firebase Hosting / Cloud Run runs FastAPI as serverless functions (no background threads, no WebSockets) — that's why crons and polling are used.

## After deploy
1. Run the SQL migrations. 2. `set_admin_claim.py`. 3. Admin -> Repositories -> "Sync from GitHub". 4. Fill in project descriptions and publish. 5. Update `sitemap.xml`/`robots.txt`/canonical URLs if your domain isn't `manav-km.dev`.
Firebase: add the deployed domain under Authentication -> Authorized domains.
