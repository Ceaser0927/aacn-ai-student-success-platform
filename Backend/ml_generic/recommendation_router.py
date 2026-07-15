from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from firebase_admin import auth

from ml_generic.auth_router import init_firebase
from ml_generic.recommendation_service import (
    get_all_recommendation_decisions,
    approve_recommendation,
    reject_recommendation,
    save_draft_recommendation,
    get_student_approved_recommendation,
    reopen_recommendation,
)
from ml_generic.recommendation_store import normalize_subject_id


router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


class RecommendationSaveRequest(BaseModel):
    subject_id: str
    probability: float
    text: str
    factual_basis: Optional[str] = None
    top_factors: List[Dict[str, Any]] = Field(default_factory=list)
    # Structured admin-facing evidence panel produced by
    # admin_router.py's _build_decision_support (Primary Concern /
    # Contributing Factors / Recommended Actions / Expected Outcome).
    # Built entirely from real numbers -- Claude never touches it -- so
    # it's safe to store and re-display verbatim on later loads/approvals.
    decision_support: Optional[Dict[str, Any]] = None
    # How many times "Polish with AI" has been run for this subject --
    # incremented client-side in recommendations.js each time a fresh
    # polish overwrites the text, so the "AI-polished wording" badge can
    # show a version number (v1, v2, ...) instead of just a flat label.
    polish_count: Optional[int] = None
    is_ai_polished: bool = False
    is_manually_edited: bool = False


class RecommendationReopenRequest(BaseModel):
    subject_id: str


def verify_firebase_token(authorization: str):
    init_firebase()

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Firebase token")

    id_token = authorization.replace("Bearer ", "")

    try:
        return auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def require_admin(authorization: str):
    decoded = verify_firebase_token(authorization)

    if decoded.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return decoded


@router.get("")
def get_recommendation_decisions(authorization: str = Header(None)):
    require_admin(authorization)

    return {
        "status": "ok",
        "items": get_all_recommendation_decisions(),
    }


@router.post("/draft")
def save_draft(
    body: RecommendationSaveRequest,
    authorization: str = Header(None),
):
    require_admin(authorization)

    saved = save_draft_recommendation(
        subject_id=body.subject_id,
        probability=body.probability,
        text=body.text,
        factual_basis=body.factual_basis,
        top_factors=body.top_factors,
        decision_support=body.decision_support,
        polish_count=body.polish_count,
        is_ai_polished=body.is_ai_polished,
        is_manually_edited=body.is_manually_edited,
    )

    return {
        "status": "ok",
        "message": "Recommendation draft saved",
        "recommendation": saved,
    }


@router.post("/approve")
def approve(
    body: RecommendationSaveRequest,
    authorization: str = Header(None),
):
    decoded = require_admin(authorization)

    saved = approve_recommendation(
        subject_id=body.subject_id,
        probability=body.probability,
        text=body.text,
        factual_basis=body.factual_basis,
        top_factors=body.top_factors,
        decision_support=body.decision_support,
        polish_count=body.polish_count,
        is_ai_polished=body.is_ai_polished,
        is_manually_edited=body.is_manually_edited,
        approved_by=decoded.get("email"),
    )

    return {
        "status": "ok",
        "message": "Recommendation approved",
        "subject_id": normalize_subject_id(body.subject_id),
        "recommendation": saved,
    }


@router.post("/reject")
def reject(
    body: RecommendationSaveRequest,
    authorization: str = Header(None),
):
    decoded = require_admin(authorization)

    saved = reject_recommendation(
        subject_id=body.subject_id,
        probability=body.probability,
        text=body.text,
        factual_basis=body.factual_basis,
        top_factors=body.top_factors,
        decision_support=body.decision_support,
        polish_count=body.polish_count,
        is_ai_polished=body.is_ai_polished,
        is_manually_edited=body.is_manually_edited,
        rejected_by=decoded.get("email"),
    )

    return {
        "status": "ok",
        "message": "Recommendation rejected",
        "subject_id": normalize_subject_id(body.subject_id),
        "recommendation": saved,
    }


@router.post("/reopen")
def reopen(
    body: RecommendationReopenRequest,
    authorization: str = Header(None),
):
    """
    Brings an approved/rejected recommendation back into the pending
    review queue -- e.g. a student was approved last term, but has since
    been re-flagged this term with new grades and needs a fresh look
    instead of staying permanently locked under last term's decision.
    """
    require_admin(authorization)

    saved = reopen_recommendation(subject_id=body.subject_id)

    return {
        "status": "ok",
        "message": "Recommendation reopened for review",
        "subject_id": normalize_subject_id(body.subject_id),
        "recommendation": saved,
    }


@router.get("/my")
def get_my_recommendation(authorization: str = Header(None)):
    decoded = verify_firebase_token(authorization)

    subject_id = normalize_subject_id(decoded.get("subject_id"))

    if not subject_id:
        raise HTTPException(status_code=403, detail="No subject_id found")

    recommendation = get_student_approved_recommendation(subject_id)

    if not recommendation:
        return {
            "status": "empty",
            "message": "No approved recommendation yet",
            "subject_id": subject_id,
            "recommendation": None,
        }

    return {
        "status": "ok",
        "subject_id": subject_id,
        "recommendation": recommendation,
    }