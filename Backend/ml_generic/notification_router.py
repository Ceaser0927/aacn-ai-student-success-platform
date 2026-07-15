from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from firebase_admin import auth, firestore

from ml_generic.auth_router import init_firebase


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class CreateNotificationRequest(BaseModel):
    uid: str
    title: str
    body: str
    type: str = "info"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def verify_token(authorization: str):
    init_firebase()

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase token")

    token = authorization.replace("Bearer ", "")

    try:
        return auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def get_db():
    init_firebase()
    return firestore.client()


@router.get("")
def list_my_notifications(authorization: str = Header(None)):
    decoded = verify_token(authorization)
    uid = decoded.get("uid")

    db = get_db()

    docs = (
        db.collection("notifications")
        .where("uid", "==", uid)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(30)
        .stream()
    )

    items = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)

    unread_count = len([item for item in items if not item.get("read")])

    return {
        "status": "ok",
        "items": items,
        "unread_count": unread_count,
    }


@router.post("/read/{notification_id}")
def mark_as_read(notification_id: str, authorization: str = Header(None)):
    decoded = verify_token(authorization)
    uid = decoded.get("uid")

    db = get_db()
    ref = db.collection("notifications").document(notification_id)
    doc = ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")

    data = doc.to_dict()

    if data.get("uid") != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    ref.set(
        {
            "read": True,
            "read_at": now_iso(),
        },
        merge=True,
    )

    return {
        "status": "ok",
        "message": "Notification marked as read",
    }


@router.post("/create")
def create_notification(
    body: CreateNotificationRequest,
    authorization: str = Header(None),
):
    decoded = verify_token(authorization)

    if decoded.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_db()

    ref = db.collection("notifications").document()

    ref.set({
        "uid": body.uid,
        "title": body.title,
        "body": body.body,
        "type": body.type,
        "read": False,
        "created_at": now_iso(),
    })

    return {
        "status": "ok",
        "message": "Notification created",
        "id": ref.id,
    }