from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from ml_generic.recommendation_store import (
    get_recommendation,
    list_recommendations,
    save_recommendation,
    normalize_subject_id,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_all_recommendation_decisions() -> Dict[str, Dict[str, Any]]:
    return list_recommendations()


def approve_recommendation(
    subject_id: str,
    probability: float,
    text: str,
    factual_basis: Optional[str] = None,
    top_factors: Optional[List[Dict[str, Any]]] = None,
    decision_support: Optional[Dict[str, Any]] = None,
    polish_count: Optional[int] = None,
    is_ai_polished: bool = False,
    is_manually_edited: bool = False,
    approved_by: Optional[str] = None,
) -> Dict[str, Any]:
    subject_id = normalize_subject_id(subject_id)

    payload = {
        "status": "approved",
        "probability": probability,
        "text": text,
        "factual_basis": factual_basis,
        "top_factors": top_factors or [],
        "decision_support": decision_support,
        "polish_count": polish_count,
        "is_ai_polished": is_ai_polished,
        "is_manually_edited": is_manually_edited,
        "approved_by": approved_by,
        "approved_at": _now_iso(),
        "rejected_at": None,
    }

    return save_recommendation(subject_id, payload)


def reject_recommendation(
    subject_id: str,
    probability: float,
    text: str,
    factual_basis: Optional[str] = None,
    top_factors: Optional[List[Dict[str, Any]]] = None,
    decision_support: Optional[Dict[str, Any]] = None,
    polish_count: Optional[int] = None,
    is_ai_polished: bool = False,
    is_manually_edited: bool = False,
    rejected_by: Optional[str] = None,
) -> Dict[str, Any]:
    subject_id = normalize_subject_id(subject_id)

    payload = {
        "status": "rejected",
        "probability": probability,
        "text": text,
        "factual_basis": factual_basis,
        "top_factors": top_factors or [],
        "decision_support": decision_support,
        "polish_count": polish_count,
        "is_ai_polished": is_ai_polished,
        "is_manually_edited": is_manually_edited,
        "rejected_by": rejected_by,
        "rejected_at": _now_iso(),
    }

    return save_recommendation(subject_id, payload)


def save_draft_recommendation(
    subject_id: str,
    probability: float,
    text: str,
    factual_basis: Optional[str] = None,
    top_factors: Optional[List[Dict[str, Any]]] = None,
    decision_support: Optional[Dict[str, Any]] = None,
    polish_count: Optional[int] = None,
    is_ai_polished: bool = False,
    is_manually_edited: bool = False,
) -> Dict[str, Any]:
    subject_id = normalize_subject_id(subject_id)

    existing = get_recommendation(subject_id)

    payload = {
        "status": existing.get("status", "pending") if existing else "pending",
        "probability": probability,
        "text": text,
        "factual_basis": factual_basis,
        "top_factors": top_factors or [],
        "decision_support": decision_support,
        "polish_count": polish_count,
        "is_ai_polished": is_ai_polished,
        "is_manually_edited": is_manually_edited,
    }

    return save_recommendation(subject_id, payload)


def reopen_recommendation(subject_id: str) -> Dict[str, Any]:
    """
    Resets an approved/rejected recommendation back to "pending" so it
    becomes editable and eligible for "Polish with AI" again. This is NOT
    the same as deleting history -- the previous text, top_factors,
    decision_support, and polish_count are kept as-is (the admin can
    re-run AI polish or edit manually to reflect a new term's data once
    predict_cohort has been re-run for this subject).

    Needed because a subject_id is a real person who takes courses every
    term -- once-approved should not mean "locked forever". If the same
    student is re-flagged after a new term's grades come in, the admin
    needs a way to bring this record back into the review queue instead
    of it being silently treated as already-handled.
    """
    subject_id = normalize_subject_id(subject_id)
    existing = get_recommendation(subject_id) or {}

    payload = {
        **existing,
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "rejected_by": None,
        "rejected_at": None,
    }

    return save_recommendation(subject_id, payload)


def get_student_approved_recommendation(subject_id: str) -> Optional[Dict[str, Any]]:
    subject_id = normalize_subject_id(subject_id)
    recommendation = get_recommendation(subject_id)

    if not recommendation:
        return None

    if recommendation.get("status") != "approved":
        return None

    return recommendation