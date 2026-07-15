from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from firebase_admin import auth

from ml_generic.auth_router import init_firebase


router = APIRouter(prefix="/api/admin/users", tags=["admin_users"])


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "student"
    subject_id: str | None = None


class UpdateUserRequest(BaseModel):
    uid: str
    email: str | None = None
    role: str | None = None
    subject_id: str | None = None
    disabled: bool | None = None


class DeleteUserRequest(BaseModel):
    uid: str


def verify_token(authorization: str):
    init_firebase()

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase token")

    token = authorization.replace("Bearer ", "")

    try:
        return auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def require_admin(authorization: str):
    decoded = verify_token(authorization)

    if decoded.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return decoded


def build_claims(role: str, subject_id: str | None):
    if role not in ["admin", "student"]:
        raise HTTPException(status_code=400, detail="role must be admin or student")

    if role == "student" and not subject_id:
        raise HTTPException(
            status_code=400,
            detail="subject_id is required for student users"
        )

    return {
        "role": role,
        "subject_id": None if role == "admin" else subject_id,
    }


@router.get("")
def list_users(authorization: str = Header(None)):
    require_admin(authorization)

    users = []

    for user in auth.list_users().iterate_all():
        claims = user.custom_claims or {}

        users.append({
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "disabled": user.disabled,
            "role": claims.get("role", "student"),
            "subject_id": claims.get("subject_id"),
            "created_at": user.user_metadata.creation_timestamp,
            "last_login_at": user.user_metadata.last_sign_in_timestamp,
        })

    return {
        "status": "ok",
        "users": users,
    }


@router.post("")
def create_user(
    body: CreateUserRequest,
    authorization: str = Header(None),
):
    require_admin(authorization)

    claims = build_claims(body.role, body.subject_id)

    try:
        user = auth.create_user(
            email=body.email,
            password=body.password,
            disabled=False,
        )

        auth.set_custom_user_claims(user.uid, claims)

        return {
            "status": "ok",
            "message": "User created",
            "uid": user.uid,
            "email": user.email,
            "role": claims["role"],
            "subject_id": claims["subject_id"],
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/update")
def update_user(
    body: UpdateUserRequest,
    authorization: str = Header(None),
):
    admin_user = require_admin(authorization)

    if body.uid == admin_user.get("uid") and body.role and body.role != "admin":
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own admin role"
        )

    update_kwargs = {}

    if body.email:
        update_kwargs["email"] = body.email

    if body.disabled is not None:
        update_kwargs["disabled"] = body.disabled

    try:
        if update_kwargs:
            auth.update_user(body.uid, **update_kwargs)

        existing_user = auth.get_user(body.uid)
        existing_claims = existing_user.custom_claims or {}

        role = body.role or existing_claims.get("role", "student")
        subject_id = body.subject_id
        if subject_id is None:
            subject_id = existing_claims.get("subject_id")

        claims = build_claims(role, subject_id)

        auth.set_custom_user_claims(body.uid, claims)

        user = auth.get_user(body.uid)

        return {
            "status": "ok",
            "message": "User updated",
            "uid": user.uid,
            "email": user.email,
            "disabled": user.disabled,
            "role": claims["role"],
            "subject_id": claims["subject_id"],
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/delete")
def delete_user(
    body: DeleteUserRequest,
    authorization: str = Header(None),
):
    admin_user = require_admin(authorization)

    if body.uid == admin_user.get("uid"):
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    try:
        auth.delete_user(body.uid)

        return {
            "status": "ok",
            "message": "User deleted",
            "uid": body.uid,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/role")
def update_user_role(
    body: UpdateUserRequest,
    authorization: str = Header(None),
):
    return update_user(body, authorization)