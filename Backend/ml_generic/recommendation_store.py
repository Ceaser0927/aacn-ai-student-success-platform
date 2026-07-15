from datetime import datetime, timezone
from typing import Dict, Any, Optional

import firebase_admin
from firebase_admin import firestore

from ml_generic.auth_router import init_firebase


COLLECTION_NAME = "recommendations"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_subject_id(value) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    return text


def get_db():
    init_firebase()
    return firestore.client()


def get_recommendation(subject_id: str) -> Optional[Dict[str, Any]]:
    subject_id = normalize_subject_id(subject_id)
    if not subject_id:
        return None

    db = get_db()
    doc = db.collection(COLLECTION_NAME).document(subject_id).get()

    if not doc.exists:
        return None

    return doc.to_dict()


def list_recommendations() -> Dict[str, Dict[str, Any]]:
    db = get_db()
    docs = db.collection(COLLECTION_NAME).stream()

    results = {}

    for doc in docs:
        data = doc.to_dict()
        results[doc.id] = data

    return results


def save_recommendation(subject_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    subject_id = normalize_subject_id(subject_id)

    if not subject_id:
        raise ValueError("subject_id is required")

    db = get_db()
    doc_ref = db.collection(COLLECTION_NAME).document(subject_id)

    existing = doc_ref.get()
    now = _now_iso()

    payload = {
        **data,
        "subject_id": subject_id,
        "updated_at": now,
    }

    if not existing.exists:
        payload["created_at"] = now
    else:
        old_data = existing.to_dict() or {}
        if old_data.get("created_at"):
            payload["created_at"] = old_data["created_at"]

    doc_ref.set(payload, merge=True)

    saved = doc_ref.get().to_dict()
    return saved