"""
firebase_auth.py

Replaces the earlier custom-JWT auth.py with Firebase Authentication.

DESIGN: role (admin/student) and subject_id are stored as Firebase
CUSTOM CLAIMS, not as a plain Firestore/database field. This matters:
custom claims can ONLY be set server-side via the Firebase Admin SDK
(exactly what this file does) -- there is no client-side API that lets a
logged-in user grant themselves a role, unlike a Firestore document field,
which would only be as safe as your Firestore security rules. This is the
Firebase-recommended pattern for "is this user an admin" style checks.

SETUP YOU NEED TO DO (this code can't do it for you):
1. In the Firebase Console, enable Email/Password sign-in
   (Authentication > Sign-in method).
2. Generate a service account key: Project Settings > Service Accounts >
   "Generate new private key". This downloads a JSON file -- keep it
   secret, never commit it to source control.
3. Set an environment variable pointing to that file before starting the
   backend:
       export FIREBASE_SERVICE_ACCOUNT_PATH="/path/to/serviceAccountKey.json"
4. pip install firebase-admin
"""

from pathlib import Path
import os

import firebase_admin
from firebase_admin import credentials, auth as fb_auth
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Literal, Optional

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------
# Firebase Admin SDK initialization
# ---------------------------------------------------------------------
_SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")

if not firebase_admin._apps:  # avoid re-initializing on hot-reload
    if _SERVICE_ACCOUNT_PATH and Path(_SERVICE_ACCOUNT_PATH).exists():
        cred = credentials.Certificate(_SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    else:
        # App is NOT initialized -- every endpoint below will raise a
        # clear error rather than crashing at import time, so the rest of
        # your backend (the non-auth routes) still works even before you
        # finish Firebase setup.
        pass


def _ensure_firebase_ready():
    if not firebase_admin._apps:
        raise HTTPException(
            500,
            "Firebase Admin SDK is not initialized. Set "
            "FIREBASE_SERVICE_ACCOUNT_PATH to your service account JSON "
            "file path and restart the backend.",
        )


# ---------------------------------------------------------------------
# Token verification / role dependencies
# ---------------------------------------------------------------------
def get_current_user(authorization: str = Header(None)) -> dict:
    """
    FastAPI dependency: verifies the Firebase ID token sent by the
    frontend (obtained from `user.getIdToken()` on the client) and
    returns its decoded claims, including any custom claims (role,
    subject_id) you've set via set_custom_user_claims.
    """
    _ensure_firebase_ready()

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header.")
    id_token = authorization.removeprefix("Bearer ").strip()

    try:
        decoded = fb_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(401, f"Invalid or expired Firebase ID token: {e}")

    return decoded


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "This action requires an admin account.")
    return user


def require_student(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "student":
        raise HTTPException(403, "This action requires a student account.")
    return user


# ---------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------
class RegisterClaimsRequest(BaseModel):
    subject_id: str


class SetRoleRequest(BaseModel):
    role: Literal["admin", "student"]


# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@router.post("/register")
def register_claims(body: RegisterClaimsRequest, user: dict = Depends(get_current_user)):
    """
    Call this ONCE, right after the frontend creates a new Firebase Auth
    account (createUserWithEmailAndPassword) and signs in. It sets this
    brand-new account's role to 'student' and links it to their
    subject_id. New accounts always start as 'student' -- there is no
    public way to register as admin (see set_role below for how admin
    status is actually granted).
    """
    _ensure_firebase_ready()
    uid = user["uid"]

    fb_auth.set_custom_user_claims(uid, {"role": "student", "subject_id": body.subject_id.strip()})
    return {"status": "ok", "role": "student", "subject_id": body.subject_id.strip()}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    """Lets the frontend check 'who am I / what's my role' on page load."""
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "role": user.get("role"),
        "subject_id": user.get("subject_id"),
    }


# ---------------------------------------------------------------------
# Admin user management -- list all users, grant/revoke admin role.
# Only an existing admin can call these (require_admin dependency).
# ---------------------------------------------------------------------
@router.get("/users")
def list_users(_admin: dict = Depends(require_admin)):
    _ensure_firebase_ready()

    users = []
    # list_users() paginates internally; iterate_all() walks every page.
    for u in fb_auth.list_users().iterate_all():
        claims = u.custom_claims or {}
        users.append({
            "uid": u.uid,
            "email": u.email,
            "role": claims.get("role", "student"),
            "subject_id": claims.get("subject_id"),
            "disabled": u.disabled,
        })
    return {"users": users}


@router.post("/users/{uid}/role")
def set_user_role(uid: str, body: SetRoleRequest, admin: dict = Depends(require_admin)):
    """
    Grants or revokes admin access for another account. This is the ONLY
    way an account's role changes after registration -- and it requires
    an existing admin's token to call, enforced server-side.
    """
    _ensure_firebase_ready()

    if uid == admin["uid"] and body.role == "student":
        raise HTTPException(400, "You can't remove your own admin access here -- ask another admin to do it.")

    try:
        target = fb_auth.get_user(uid)
    except Exception:
        raise HTTPException(404, "No user found with that ID.")

    existing_claims = target.custom_claims or {}
    fb_auth.set_custom_user_claims(uid, {**existing_claims, "role": body.role})

    return {"status": "ok", "uid": uid, "role": body.role}