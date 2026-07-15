import os
import json
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import firebase_admin
from firebase_admin import auth, credentials


router = APIRouter(prefix="/api/auth", tags=["auth"])


ADMIN_EMAILS = {
    "adminaacn@gmail.com",
}


class RegisterRequest(BaseModel):
    subject_id: str | None = None


def init_firebase():
    if firebase_admin._apps:
        return

    firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    firebase_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    default_path = Path("firebase-service-account.json")

    try:
        if firebase_json:
            cred_dict = json.loads(firebase_json)
            cred = credentials.Certificate(cred_dict)

        elif firebase_path and Path(firebase_path).exists():
            cred = credentials.Certificate(firebase_path)

        elif default_path.exists():
            cred = credentials.Certificate(str(default_path))

        else:
            raise RuntimeError(
                "Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT, "
                "FIREBASE_SERVICE_ACCOUNT_PATH, or place firebase-service-account.json "
                "in the Backend directory."
            )

        firebase_admin.initialize_app(cred)

    except Exception as e:
        raise RuntimeError(f"Firebase initialization failed: {e}")


@router.post("/register")
def register_user(data: RegisterRequest, authorization: str = Header(None)):
    try:
        init_firebase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase token")

    id_token = authorization.replace("Bearer ", "").strip()

    try:
        decoded_token = auth.verify_id_token(id_token)

        uid = decoded_token["uid"]
        email = decoded_token.get("email", "").lower()

        role = "admin" if email in ADMIN_EMAILS else "student"

        if role == "student" and not data.subject_id:
            raise HTTPException(
                status_code=400,
                detail="subject_id is required for student users"
            )

        custom_claims = {
            "role": role,
            "subject_id": None if role == "admin" else data.subject_id
        }

        auth.set_custom_user_claims(uid, custom_claims)

        return {
            "message": "User registered successfully",
            "role": role,
            "subject_id": custom_claims["subject_id"],
            "email": email
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/make-admin")
def make_admin():
    try:
        init_firebase()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    email = "adminaacn@gmail.com"

    try:
        user = auth.get_user_by_email(email)

        auth.set_custom_user_claims(user.uid, {
            "role": "admin",
            "subject_id": None
        })

        return {
            "message": "Admin claim set successfully",
            "email": email,
            "uid": user.uid,
            "role": "admin",
            "subject_id": None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))