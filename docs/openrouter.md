# OpenRouter (AI, backend only)

What it does: one API in front of many LLMs. The site uses it to (1) summarise client requests, (2) write short audit-log notes, (3) sanity-check request categories, (4) summarise conversations.
Key: `OPENROUTER_API_KEY` (**SECRET**, backend env only). Model: `OPENROUTER_MODEL` (any slug from openrouter.ai/models; a `:free` model works to start).
Change model later = change that one variable and redeploy. Change provider = add a file under `backend/app/services/ai/providers/` and point `service.py` at it.
If the model is down or rate-limited: the request/audit event is still saved, the AI field stays `failed`/`pending`, an hourly cron (`/admin/cron/retry-ai`) retries, and the admin can press "Regenerate". AI output is JSON-validated (Pydantic) before it is stored and is rendered as plain text.
