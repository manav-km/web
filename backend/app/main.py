"""app/main.py — wires everything together."""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import (
    achievements, admin, auth, blog, connect, conversations, messages,
    notifications, profile, projects, repositories, reviews, security, tasks, uploads,
)
from app.core.config import get_settings

logger = logging.getLogger("app")
settings = get_settings()

# Docs/OpenAPI are disabled in production surface area: they enumerate every endpoint.
app = FastAPI(title="Manav-KM Portfolio API", docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,     # frontend domains + local dev
    allow_credentials=False,                    # bearer tokens, not cookies -> no CSRF surface
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

MAX_BODY_BYTES = 1_000_000  # 1 MB — the API accepts JSON only; uploads go via Supabase Storage

_PRIVATE_PREFIXES = (
    "/api/v1/admin", "/api/v1/security", "/api/v1/messages", "/api/v1/connect",
    "/api/v1/profile", "/api/v1/notifications", "/api/v1/requests",
    "/api/v1/reviews", "/api/v1/conversations",
)


@app.middleware("http")
async def enforce_https(request: Request, call_next):
    if settings.enforce_https and request.headers.get("x-forwarded-proto") == "http":
        url = str(request.url).replace("http://", "https://", 1)
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=url, status_code=308)
    return await call_next(request)


@app.middleware("http")
async def harden(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request too large"}, status_code=413)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith(_PRIVATE_PREFIXES) else response.headers.get("Cache-Control", "public, max-age=60")
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if settings.enforce_https:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": f"{type(exc).__name__}: {str(exc)}"}, status_code=500)


for module in (
    auth, profile, projects, repositories, achievements, uploads, blog,
    connect, conversations, messages, notifications, reviews, admin, security, tasks,
):
    app.include_router(module.router)


@app.get("/api/v1/health")
def health():
    return {"ok": True}
