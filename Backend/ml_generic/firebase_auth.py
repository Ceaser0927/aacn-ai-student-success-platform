"""
firebase_auth.py

Firebase Authentication helper for AACN backend.

Supports three Firebase Admin SDK setup methods:

1. Render / production:
   FIREBASE_SERVICE_ACCOUNT = full Firebase service account JSON string

2. Local / custom path:
   FIREBASE_SERVICE_ACCOUNT_PATH = path to service account JSON file

3. Local fallback:
   firebase-service-account.json in Backend directory
"""

from pathlib import Path
import os
import json

import firebase_admin
from firebase_admin import credentials, auth as fb_auth
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Literal


router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------
# Firebase Admin SDK initialization
# ---------------------------------------------------------------------
def init_firebase():
    if firebase_admin._apps:
        return

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    default_service_account_path = Path("firebase-service-account.json")

    try:
        if service_account_json:
            cred = credentials.Certificate(json.loads(service_account_json))

        elif service_account_path and Path(service_account_path).exists():
            cred = credentials.Certificate(service_account_path)

        elif default_service_account_path.exists():
            cred = credentials.Certificate(str(default_service_account_path))

        else:
            return

        firebase_admin.initialize_app(cred)

    except Exception as e:
        raise RuntimeError(f"Firebase initialization failed: {e}")


init_firebase()


def _ensure_firebase_ready():
    if not firebase_admin._apps:
        raise HTTPException(
            500,
            "Firebase Admin SDK is not initialized. Set FIREBASE_SERVICE_ACCOUNT, "
            "FIREBASE_SERVICE_ACCOUNT_PATH, or place firebase-service-account.json "
            "in the Backend directory.",
        )


# ---------------------------------------------------------------------
# Token verification / role dependencies
# ---------------------------------------------------------------------
def get_current_user(authorization: str = Header(None)) -> dict:
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
    _ensure_firebase_ready()

    uid = user["uid"]

    fb_auth.set_custom_user_claims(
        uid,
        {
            "role": "student",
            "subject_id": body.subject_id.strip(),
        },
    )

    return {
        "status": "ok",
        "role": "student",
        "subject_id": body.subject_id.strip(),
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "role": user.get("role"),
        "subject_id": user.get("subject_id"),
    }


@router.get("/users")
def list_users(_admin: dict = Depends(require_admin)):
    _ensure_firebase_ready()

    users = []

    for u in fb_auth.list_users().iterate_all():
        claims = u.custom_claims or {}
        users.append(
            {
                "uid": u.uid,
                "email": u.email,
                "role": claims.get("role", "student"),
                "subject_id": claims.get("subject_id"),
                "disabled": u.disabled,
            }
        )

    return {"users": users}


@router.post("/users/{uid}/role")
def set_user_role(uid: str, body: SetRoleRequest, admin: dict = Depends(require_admin)):
    _ensure_firebase_ready()

    if uid == admin["uid"] and body.role == "student":
        raise HTTPException(
            400,
            "You can't remove your own admin access here -- ask another admin to do it.",
        )

    try:
        target = fb_auth.get_user(uid)
    except Exception:
        raise HTTPException(404, "No user found with that ID.")

    existing_claims = target.custom_claims or {}

    fb_auth.set_custom_user_claims(
        uid,
        {
            **existing_claims,
            "role": body.role,
        },
    )

    return {
        "status": "ok",
        "uid": uid,
        "role": body.role,
    }