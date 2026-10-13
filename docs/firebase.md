# Firebase (Authentication only)

Already created by you. Checklist:
1. Console -> Authentication -> Sign-in method: enable **Email/Password** and **Google**.
2. Authentication -> Settings -> Authorized domains: add your production domain (and `localhost`).
3. Project settings -> General -> Your apps -> Web app: copy the config object into `frontend/js/core/config.js` (**public** values — safe in the browser).
4. Project settings -> Service accounts -> Generate new private key: this is **SECRET**. Put it in Firebase Hosting / Cloud Run (backend project) as `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the JSON contents). Never commit it.
5. Templates (Authentication -> Templates): customise the verification / password-reset emails if you like.

Admin = a Firebase **custom claim** (`admin: true`) set with `backend/scripts/set_admin_claim.py`. The backend trusts only that claim from a verified token.

## Realtime Database (chat lives here now)

**Architecture**: conversations and messages are now stored in RTDB, not
Supabase — see `docs/architecture.md` §13b for the full reasoning. FastAPI
still writes every conversation/message (via the Admin SDK, which bypasses
the rules below the same way the Supabase service-role key bypasses RLS) —
the browser reads them directly for instant delivery, and writes drafts/
typing/presence directly itself (low-stakes, high-frequency, no round-trip
needed).

### Schema

```text
/conversations/{convId}
    request_id, client_uid, participants: {uid: true, ...},
    created_at, latest_message_preview, latest_message_at, active

/messages/{convId}/{msgId}
    id, conversation_id, sender_uid, content, created_at, read_at

/drafts/{convId}/{uid}            content           — client-written
/typing/{convId}/{uid}            true|false         — client-written
/presence/{uid}                   {online, last_changed}  — client-written
/unread/{uid}/{convId}            number             — client can only zero their own
/signals/{uid}                    {kind, at, ...}     — non-chat live notification ping
```

### Setup

1. Console -> Build -> Realtime Database -> **Create Database**. Pick a
   location close to your audience. Start in **locked mode**.
2. Deploy the rules: `cd firebase && firebase deploy --only database`
   (Firebase CLI logged into this project), or paste
   `firebase/database.rules.json` into Console -> Realtime Database ->
   Rules and Publish. The rules: a user reads a conversation/its messages
   only if they're in its `participants` map; a user writes/reads their own
   drafts, typing state, presence, and signal path only; nobody writes
   `/conversations` or `/messages` directly (FastAPI/Admin SDK only); a
   user can zero but never increment `/unread`.
3. Copy the database URL into `FIREBASE_DATABASE_URL` on the **backend**.
4. On the **frontend**, the Firebase web config (`frontend/js/core/config.js`)
   needs a `databaseURL` field too, since the browser now reads/writes RTDB
   directly — add it alongside the existing public Firebase config values.

Until step 3 is done, chat falls back gracefully: `services/firebase_rtdb.py`
calls will simply fail loudly in development (there's no real chat without
RTDB in this architecture, unlike the old signal-only design) — enable it
before testing Connect end-to-end.

working via polling, nothing breaks.

### Non-chat notification signal (`/signals/{uid}`)

Separate from chat: `services/realtime.py` pings `/signals/{uid}` for
status changes, new reviews, etc. (durable record always in Supabase
first). This one IS graceful if RTDB isn't configured yet — it no-ops
silently rather than failing, since it's an enhancement, not the primary
data path the way chat now is.
