"""Realtime signal tests: fires where expected, and is fail-safe when RTDB errors or isn't configured."""
import os
os.environ.update(FIREBASE_PROJECT_ID="x", FIREBASE_SERVICE_ACCOUNT_JSON="x", SUPABASE_URL="https://x.supabase.co",
                  SUPABASE_SERVICE_ROLE_KEY="x", OPENROUTER_API_KEY="x", FRONTEND_ORIGIN="https://site.test")
from unittest.mock import MagicMock, patch

from app.services import realtime


def test_signal_noop_without_uid():
    with patch("app.services.realtime.init_firebase") as init:
        realtime.signal(None, "new_message")
        init.assert_not_called()  # never even touches Firebase for an empty uid


def test_signal_noop_when_database_url_unset():
    settings = MagicMock(firebase_database_url=None)
    with patch("app.services.realtime.init_firebase"), \
         patch("app.services.realtime.get_settings", return_value=settings), \
         patch("app.services.realtime.rtdb") as rtdb:
        realtime.signal("user1", "new_message")
        rtdb.reference.assert_not_called()  # RTDB not enabled yet -> silent no-op


def test_signal_writes_when_configured():
    settings = MagicMock(firebase_database_url="https://x.firebasedatabase.app")
    ref = MagicMock()
    with patch("app.services.realtime.init_firebase"), \
         patch("app.services.realtime.get_settings", return_value=settings), \
         patch("app.services.realtime.rtdb") as rtdb:
        rtdb.reference.return_value = ref
        realtime.signal("user1", "new_message", {"conversation_id": "c1"})
        rtdb.reference.assert_called_once_with("/signals/user1")
        written = ref.set.call_args[0][0]
        assert written["kind"] == "new_message" and written["conversation_id"] == "c1" and "at" in written


def test_signal_never_raises_on_rtdb_failure():
    settings = MagicMock(firebase_database_url="https://x.firebasedatabase.app")
    with patch("app.services.realtime.init_firebase"), \
         patch("app.services.realtime.get_settings", return_value=settings), \
         patch("app.services.realtime.rtdb") as rtdb:
        rtdb.reference.side_effect = RuntimeError("network down")
        realtime.signal("user1", "new_message")  # must not raise


def test_message_send_triggers_signal_to_admin():
    """Sending a message as the client should ping the admin's signal path."""
    from unittest.mock import AsyncMock
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)

    def fake_verify(token):
        return {"uid": "user1", "email": "u@x.com"} if token == "user-tok" else (_ for _ in ()).throw(
            __import__("firebase_admin").auth.InvalidIdTokenError("bad"))

    fake_rpc_result = MagicMock(data=[{"blocked": False, "blocked_until": None}])
    fake_limiter_sb = MagicMock()
    fake_limiter_sb.rpc.return_value.execute.return_value = fake_rpc_result

    with patch("app.core.security.verify_id_token", fake_verify), \
         patch("app.core.security.get_supabase", return_value=MagicMock()), \
         patch("app.services.security_monitor.get_supabase", return_value=fake_limiter_sb), \
         patch("app.api.v1.messages._assert_participant", return_value=None), \
         patch("app.api.v1.messages.firebase_rtdb.send_message", return_value={"id": "m1", "conversation_id": "c1", "sender_uid": "user1", "content": "hi", "created_at": 1750000000000, "read_at": None}), \
         patch("app.api.v1.messages.firebase_rtdb.get_conversation", return_value={"id": "c1", "client_uid": "user1", "participants": {"user1": True, "admin1": True}}), \
         patch("app.api.v1.messages.notifications_db.create") as create_notif, \
         patch("app.api.v1.messages.realtime.signal") as signal, \
         patch("app.api.v1.messages.audit.log_event", new=AsyncMock()), \
         patch("app.api.v1.messages.get_settings", return_value=MagicMock(admin_firebase_uid="admin1")):
        r = client.post("/api/v1/messages/c1", headers={"Authorization": "Bearer user-tok"}, json={"content": "hi"})

    assert r.status_code == 200
    create_notif.assert_called_once_with("admin1", "new_message", {"conversation_id": "c1"})
    signal.assert_called_once_with("admin1", "new_message", {"conversation_id": "c1"})
