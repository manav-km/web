"""
One-off script: gives YOUR Firebase account the `admin: true` custom claim.

Run it locally (never on the server / never committed with a real key):
    cd backend
    export FIREBASE_SERVICE_ACCOUNT_JSON=path/to/service-account.json
    python scripts/set_admin_claim.py <your-firebase-uid>

Find your UID: sign in on the site once, then Firebase Console -> Authentication -> Users.
After running it, sign out and back in on the site so your ID token picks up the claim.
"""
import os
import sys

import firebase_admin
from firebase_admin import auth, credentials

if len(sys.argv) != 2:
    sys.exit("usage: python scripts/set_admin_claim.py <firebase-uid>")

raw = os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"]
firebase_admin.initialize_app(credentials.Certificate(raw))
auth.set_custom_user_claims(sys.argv[1], {"admin": True})
auth.revoke_refresh_tokens(sys.argv[1])  # forces a fresh token that carries the claim
print(f"admin claim set for {sys.argv[1]}")
