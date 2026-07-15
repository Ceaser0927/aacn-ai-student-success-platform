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
    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase-service-account.json")
        firebase_admin.initialize_app(cred)


@router.post("/register")
def register_user(data: RegisterRequest, authorization: str = Header(None)):
    init_firebase()

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase token")

    id_token = authorization.replace("Bearer ", "")

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
    init_firebase()

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