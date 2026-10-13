"""Authorization smoke tests with Firebase + Supabase mocked out (no network, no credentials)."""
import os
os.environ.update(FIREBASE_PROJECT_ID="x", FIREBASE_SERVICE_ACCOUNT_JSON="x", SUPABASE_URL="https://x.supabase.co",
                  SUPABASE_SERVICE_ROLE_KEY="x", OPENROUTER_API_KEY="x", FRONTEND_ORIGIN="https://site.test")
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)
TOKENS = {"admin-tok": {"uid": "admin1", "email": "a@x.com", "admin": True}, "user-tok": {"uid": "user1", "email": "u@x.com"}}


def fake_verify(token):
    if token in TOKENS:
        return TOKENS[token]
    from firebase_admin import auth
    raise auth.InvalidIdTokenError("bad")


def fake_sb():
    sb = MagicMock()
    chain = sb.table.return_value
    for m in ("select", "eq", "order", "insert", "update", "upsert", "delete", "neq", "in_", "is_", "contains", "range", "gte", "lte"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = MagicMock(data=[], count=0)
    chain.maybe_single.return_value = chain
    return sb


def setup_module():
    for target in ("app.core.security.verify_id_token",):
        patch(target, fake_verify).start()
    for target in ("app.core.security.get_supabase", "app.services.audit.get_supabase", "app.db.projects.get_supabase",
                   "app.db.client_requests.get_supabase", "app.db.tasks.get_supabase"):
        patch(target, fake_sb).start()
    patch("app.services.audit.ai_service.audit_log_note", new=MagicMock(side_effect=lambda *a, **k: _none())).start()


async def _none():
    return None


def auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_public_projects_needs_no_auth():
    assert client.get("/api/v1/projects").status_code == 200


def test_admin_routes_reject_anonymous():
    for path in ("/api/v1/admin/overview", "/api/v1/admin/clients", "/api/v1/projects/admin", "/api/v1/security/events", "/api/v1/admin/audit"):
        assert client.get(path).status_code == 401, path


def test_admin_routes_reject_normal_user():
    for path in ("/api/v1/admin/overview", "/api/v1/admin/clients", "/api/v1/projects/admin", "/api/v1/security/events", "/api/v1/admin/audit"):
        assert client.get(path, headers=auth("user-tok")).status_code == 403, path


def test_admin_writes_reject_normal_user():
    assert client.post("/api/v1/projects/admin", headers=auth("user-tok"), json={"name": "x", "description": "y", "category": "websites"}).status_code == 403
    assert client.delete("/api/v1/projects/admin/abc", headers=auth("user-tok")).status_code == 403


def test_invalid_token_rejected():
    assert client.get("/api/v1/profile", headers=auth("garbage")).status_code == 401


def test_conversation_ownership_enforced():
    with patch("app.services.firebase_rtdb.is_participant", return_value=False):
        assert client.get("/api/v1/messages/some-convo", headers=auth("user-tok")).status_code == 403
        assert client.put("/api/v1/messages/some-convo/draft", headers=auth("user-tok"), json={"content": "hi"}).status_code == 403


def test_cron_endpoint_needs_secret():
    assert client.get("/api/v1/admin/cron/sync-github").status_code == 403


def test_security_headers_and_no_docs():
    r = client.get("/api/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert client.get("/docs").status_code == 404 and client.get("/openapi.json").status_code == 404


def test_oversized_body_rejected():
    r = client.post("/api/v1/connect", headers={**auth("user-tok"), "content-length": "5000000"}, content=b"{}")
    assert r.status_code == 413


def test_cors_locked_to_frontend_origin():
    r = client.options("/api/v1/projects", headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_task_routes_reject_non_admin():
    for path in ("/api/v1/admin/request/req1/tasks", "/api/v1/admin/request/req1/completion"):
        assert client.get(path, headers=auth("user-tok")).status_code == 403, path
    assert client.post("/api/v1/admin/request/req1/tasks", headers=auth("user-tok"), json={"title": "x"}).status_code == 403


def test_task_owner_type_validated():
    assert client.get("/api/v1/admin/bogus/req1/tasks", headers=auth("admin-tok")).status_code == 400
