"""api/v1/reviews.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, get_current_user
from app.db import client_requests as requests_db
from app.db import reviews as db
from app.models.client import ReviewCreate, ReviewOut
from app.services import audit

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


@router.post("/{request_id}", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def submit_review(
    request_id: str, payload: ReviewCreate, request: Request, user: CurrentUser = Depends(get_current_user)
):
    client_request = requests_db.get_for_uid(request_id, user.uid)
    if not client_request:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if client_request["status"] != "completed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reviews can only be left once a request is completed")
    if db.get_for_request(request_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A review already exists for this request")

    created = db.create(request_id, user.uid, payload.model_dump())
    await audit.log_event(
        category="content", action="review_submitted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"request_id": request_id}, generate_ai_note=False,
    )
    return created


@router.get("/{request_id}")
def get_review(request_id: str, user: CurrentUser = Depends(get_current_user)):
    client_request = requests_db.get_for_uid(request_id, user.uid)
    if not client_request:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return db.get_for_request(request_id)
