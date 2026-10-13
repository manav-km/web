"""models/client.py — Connect form submission, client request records, reviews."""
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.common import RequestCategory, RequestStatus


class ClientRequestCreate(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    phone: str = Field(min_length=1)
    country: str = Field(min_length=1)
    profession: str = Field(min_length=1)
    business: str = Field(min_length=1)
    category: RequestCategory
    deadline: date
    budget: str = Field(min_length=1)
    project_description: str = Field(min_length=10)
    turnstile_token: str | None = None  # Cloudflare Turnstile — verified server-side, see services/turnstile.py
    age_confirmed: bool = False          # Must be True at submit time; validated server-side before DB write
    privacy_accepted: bool = False       # Must be True at submit time; validated server-side before DB write


class ClientRequestOut(ClientRequestCreate):
    id: str
    firebase_uid: str
    status: RequestStatus
    ai_overview: dict | None = None
    ai_status: str
    checklist_status: str
    rtdb_conversation_id: str | None = None
    created_at: datetime
    updated_at: datetime


class StatusChange(BaseModel):
    new_status: RequestStatus
    note: str | None = None


class ReviewCreate(BaseModel):
    overall_rating: int = Field(ge=1, le=5)
    professionalism_rating: int = Field(ge=1, le=5)
    satisfaction_rating: int = Field(ge=1, le=5)
    expectations_rating: int = Field(ge=1, le=5)
    usability_rating: int = Field(ge=1, le=5)
    pricing_rating: int = Field(ge=1, le=5)
    sufficiency_rating: int = Field(ge=1, le=5)
    note: str | None = None


class ReviewOut(ReviewCreate):
    id: str
    request_id: str
    client_uid: str
    created_at: datetime
