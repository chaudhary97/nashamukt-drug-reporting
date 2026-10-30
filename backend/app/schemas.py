
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ENUMS

class ReportCategory(str, Enum):
    DRUG_CONSUMER = "drug_consumer"
    DRUG_SELLER = "drug_seller"
    DRUG_PRODUCER = "drug_producer"
    MISCELLANEOUS = "miscellaneous"


class ReportStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    INVESTIGATION_IN_PROGRESS = "investigation_in_progress"
    INVESTIGATION_SUBMITTED = "investigation_submitted"
    ADMIN_VERIFICATION = "admin_verification"
    ACTION_COMPLETED = "action_completed"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"


class ReportPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class VerificationResult(str, Enum):
    VERIFIED = "verified"
    FALSE = "false"
    INCONCLUSIVE = "inconclusive"


class AdminInvestigationDecision(str, Enum):
    VERIFIED = "verified"
    FALSE = "false"
    INCONCLUSIVE = "inconclusive"


# CITIZEN REPORT SCHEMA

class ReportCreate(BaseModel):
    category: ReportCategory
    description: str = Field(min_length=20, max_length=5000)
    location_text: str = Field(min_length=3, max_length=500)

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    observed_frequency: str | None = Field(default=None, max_length=100)
    observed_quantity: str | None = Field(default=None, max_length=150)
    incident_datetime: datetime | None = None

    @field_validator("description", "location_text")
    @classmethod
    def reject_blank_text(cls, value: str):
        if not value.strip():
            raise ValueError("This field cannot be empty")
        return value.strip()


# CITIZEN TRACKING SCHEMA

class ReportTrackRequest(BaseModel):
    tracking_reference: str = Field(min_length=8, max_length=30)
    tracking_secret: str = Field(min_length=20, max_length=100)


class ReportTrackResponse(BaseModel):
    tracking_reference: str
    status: ReportStatus
    created_at: datetime
    updated_at: datetime


# LOGIN SCHEMAS

class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# ADMIN ASSIGNMENT SCHEMA

class ReportAssignmentCreate(BaseModel):
    officer_id: UUID
    priority: ReportPriority = ReportPriority.MEDIUM
    deadline: datetime | None = None


# OFFICER INVESTIGATION SCHEMA

class InvestigationCreate(BaseModel):
    findings: str = Field(min_length=20, max_length=10000)
    verification_result: VerificationResult
    action_taken: str | None = Field(default=None, max_length=5000)

    @field_validator("findings")
    @classmethod
    def validate_findings(cls, value: str):
        if not value.strip():
            raise ValueError("Investigation findings cannot be empty")
        return value.strip()


# ADMIN INVESTIGATION REVIEW SCHEMA

class AdminInvestigationReview(BaseModel):
    decision: AdminInvestigationDecision


# ADMIN STATUS UPDATE SCHEMA

class ReportStatusUpdate(BaseModel):
    status: ReportStatus
    remarks: str | None = Field(default=None, max_length=2000)


# USER RESPONSE SCHEMA

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    username: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
