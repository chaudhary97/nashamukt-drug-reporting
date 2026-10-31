import os
import uuid
import hashlib
import secrets
import hmac
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import Request
from app.models import ReportReward
from app.config import settings
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)
import re
import requests
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc
from jose import jwt, JWTError

from app.config import settings
from app.database import get_db
from app.models import (
    User,
    UserRole,
    Report,
    ReportAssignment,
    Investigation,
    ReportCategory,
    ReportStatus,
    ReportPriority,
    RewardSetting,
    ReportReward,
)

router = APIRouter()
security = HTTPBearer()

JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM = settings.JWT_ALGORITHM

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend .env")

BASE_DIR = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = BASE_DIR / "private_evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_FILES = 5

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.id == user_id).first()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User not found or inactive",
            )

        return user

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


def require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return user


def require_officer(user: User = Depends(get_current_user)):
    if user.role != UserRole.OFFICER:
        raise HTTPException(
            status_code=403,
            detail="Officer access required",
        )
    return user


def verify_assignment(report_id: str, officer_id: str, db: Session):
    assignment = (
        db.query(ReportAssignment)
        .filter(
            ReportAssignment.report_id == report_id,
            ReportAssignment.officer_id == officer_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="This report is not assigned to you",
        )

    return assignment


async def validate_and_save_file(file: UploadFile):
    content_type = file.content_type

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}",
        )

    extension = ALLOWED_TYPES[content_type]
    content = await file.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Empty file uploaded",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Each file must be 20 MB or smaller",
        )

    valid_signature = False

    if content_type == "image/jpeg":
        valid_signature = content.startswith(b"\xff\xd8\xff")

    elif content_type == "image/png":
        valid_signature = content.startswith(b"\x89PNG\r\n\x1a\n")

    elif content_type == "image/webp":
        valid_signature = (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        )

    elif content_type in ["video/mp4", "video/quicktime"]:
        valid_signature = (
            len(content) >= 12
            and content[4:8] == b"ftyp"
        )

    if not valid_signature:
        raise HTTPException(
            status_code=400,
            detail="File content does not match its declared type",
        )

    stored_name = f"{uuid.uuid4().hex}{extension}"
    file_path = EVIDENCE_DIR / stored_name

    with open(file_path, "wb") as output:
        output.write(content)

    return {
        "stored_name": stored_name,
        "original_name": Path(file.filename or "evidence").name,
        "content_type": content_type,
        "size": len(content),
    }


# Citizen submits an anonymous report

@router.post("/reports")
def create_report(payload: dict, db: Session = Depends(get_db)):
    required_fields = [
        "category",
        "description",
        "location_text",
        "observed_frequency",
        "incident_datetime",
    ]

    for field in required_fields:
        if not payload.get(field):
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required",
            )

    if len(payload["description"].strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Description must contain at least 20 characters",
        )

    latitude = payload.get("latitude")
    longitude = payload.get("longitude")

    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be provided together",
        )

    if latitude is not None:
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid GPS coordinates",
            )

        if not -90 <= latitude <= 90:
            raise HTTPException(
                status_code=400,
                detail="Latitude must be between -90 and 90",
            )

        if not -180 <= longitude <= 180:
            raise HTTPException(
                status_code=400,
                detail="Longitude must be between -180 and 180",
            )

    try:
        category = ReportCategory(payload["category"])
        incident_datetime = datetime.fromisoformat(
            payload["incident_datetime"].replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid category or date",
        )

    tracking_reference = f"NM-{secrets.token_hex(5).upper()}"
    tracking_secret = secrets.token_urlsafe(24)

    report = Report(
        tracking_reference=tracking_reference,
        tracking_secret_hash=hash_secret(tracking_secret),
        category=category,
        description=payload["description"].strip(),
        location_text=payload["location_text"].strip(),
        latitude=latitude,
        longitude=longitude,
        observed_frequency=payload["observed_frequency"],
        observed_quantity=payload.get("observed_quantity"),
        incident_datetime=incident_datetime,
        status=ReportStatus.SUBMITTED,
        priority=ReportPriority.MEDIUM,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "message": "Report submitted successfully",
        "tracking_reference": tracking_reference,
        "tracking_secret": tracking_secret,
        "status": report.status.value,
    }


# Citizen tracks a report without logging in

@router.post("/reports/track")
def track_report(payload: dict, db: Session = Depends(get_db)):
    reference = payload.get("tracking_reference")
    secret = payload.get("tracking_secret")

    if not reference or not secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    return {
        "tracking_reference": report.tracking_reference,
        "category": report.category.value,
        "status": report.status.value,
        "priority": report.priority.value,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


# Admin and officer login

@router.post("/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    from pwdlib import PasswordHash

    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password required",
        )

    user = db.query(User).filter(User.username == username).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    password_hasher = PasswordHash.recommended()

    if not password_hasher.verify(password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.value,
        "username": user.username,
    }


# Admin views all reports

@router.get("/admin/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    reports = db.query(Report).order_by(desc(Report.created_at)).all()

    return [
        {
            "id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "category": report.category.value,
            "description": report.description,
            "location_text": report.location_text,
            "priority": report.priority.value,
            "status": report.status.value,
            "created_at": report.created_at,
        }
        for report in reports
    ]


# Admin views officers

@router.get("/admin/officers")
def get_officers(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    officers = (
        db.query(User)
        .filter(
            User.role == UserRole.OFFICER,
            User.is_active.is_(True),
        )
        .all()
    )

    return [
        {
            "id": str(officer.id),
            "full_name": officer.full_name,
            "username": officer.username,
        }
        for officer in officers
    ]


# Admin assigns report to officer

@router.post("/admin/reports/{report_id}/assign")
def assign_report(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    officer_id = payload.get("officer_id")
    deadline = payload.get("deadline")

    if not officer_id or not deadline:
        raise HTTPException(
            status_code=400,
            detail="Officer ID and deadline are required",
        )

    officer = (
        db.query(User)
        .filter(
            User.id == officer_id,
            User.role == UserRole.OFFICER,
            User.is_active.is_(True),
        )
        .first()
    )

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found",
        )

    try:
        deadline_value = datetime.fromisoformat(
            deadline.replace("Z", "+00:00")
        )
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid deadline",
        )

    assignment = ReportAssignment(
        report_id=report.id,
        officer_id=officer.id,
        assigned_by=admin.id,
        deadline=deadline_value,
    )

    report.status = ReportStatus.ASSIGNED

    db.add(assignment)
    db.commit()

    return {"message": "Report assigned successfully"}


# Officer views assigned reports

@router.get("/officer/assignments")
def get_officer_assignments(
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
):
    assignments = (
        db.query(ReportAssignment)
        .filter(ReportAssignment.officer_id == officer.id)
        .order_by(desc(ReportAssignment.assigned_at))
        .all()
    )

    results = []

    for assignment in assignments:
        report = assignment.report

        results.append({
            "assignment_id": str(assignment.id),
            "report_id": str(report.id),
            "category": report.category.value,
            "description": report.description,
            "location_text": report.location_text,
            "priority": report.priority.value,
            "status": report.status.value,
            "deadline": assignment.deadline,
        })

    return results


# Officer submits investigation with GPS and optional photo/video evidence

@router.post("/officer/reports/{report_id}/investigation")
async def submit_investigation(
    report_id: str,
    findings: str = Form(...),
    verification_result: str = Form(...),
    action_taken: str = Form(""),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    verify_assignment(report_id, str(officer.id), db)

    if report.status not in [
        ReportStatus.ASSIGNED,
        ReportStatus.INVESTIGATION_IN_PROGRESS,
    ]:
        raise HTTPException(
            status_code=400,
            detail="This report cannot accept an investigation submission",
        )

    if len(findings.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Investigation findings must contain at least 20 characters",
        )

    if verification_result not in [
        "verified",
        "false",
        "inconclusive",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Verification result must be verified, false, or inconclusive",
        )

    # Validate officer GPS coordinates

    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Officer latitude and longitude must be provided together",
        )

    if latitude is not None:
        if not -90 <= latitude <= 90:
            raise HTTPException(
                status_code=400,
                detail="Latitude must be between -90 and 90",
            )

        if not -180 <= longitude <= 180:
            raise HTTPException(
                status_code=400,
                detail="Longitude must be between -180 and 180",
            )

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"You can upload a maximum of {MAX_FILES} files",
        )

    saved_files = []

    try:
        for file in files:
            saved_file = await validate_and_save_file(file)
            saved_files.append(saved_file)

        investigation = Investigation(
            report_id=report.id,
            officer_id=officer.id,
            findings=findings.strip(),
            verification_result=verification_result,
            action_taken=action_taken.strip() or None,
            latitude=latitude,
            longitude=longitude,
            evidence_files=saved_files,
        )

        report.status = ReportStatus.INVESTIGATION_SUBMITTED

        db.add(investigation)
        db.commit()

    except Exception:
        db.rollback()

        for saved_file in saved_files:
            file_path = EVIDENCE_DIR / saved_file["stored_name"]

            if file_path.exists():
                file_path.unlink()

        raise

    return {
        "message": "Investigation submitted successfully",
        "status": report.status.value,
        "uploaded_files": len(saved_files),
        "latitude": latitude,
        "longitude": longitude,
    }


# Admin reviews officer investigation

@router.post("/admin/reports/{report_id}/review")
def review_investigation(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if report.status != ReportStatus.INVESTIGATION_SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail="Investigation has not been submitted",
        )

    decision = payload.get("decision")

    if decision not in [
        "approved",
        "rejected",
        "inconclusive",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Decision must be approved, rejected, or inconclusive",
        )

    if decision == "approved":
        report.status = ReportStatus.ADMIN_VERIFICATION
    elif decision == "rejected":
        report.status = ReportStatus.REJECTED
    else:
        report.status = ReportStatus.INCONCLUSIVE

    db.commit()

    return {
        "message": "Investigation reviewed",
        "status": report.status.value,
    }


# Admin completes verified action

@router.post("/admin/reports/{report_id}/complete")
def complete_report(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if report.status != ReportStatus.ADMIN_VERIFICATION:
        raise HTTPException(
            status_code=400,
            detail="Only reports under admin verification can be completed",
        )

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if not investigation or investigation.verification_result != "verified":
        raise HTTPException(
            status_code=400,
            detail="Only verified investigations can be completed",
        )

    report.status = ReportStatus.ACTION_COMPLETED
    db.commit()

    return {
        "message": "Report marked as action completed",
        "status": report.status.value,
    }


# Admin and assigned officer can access investigation evidence

@router.get("/reports/{report_id}/evidence/{filename}")
def get_investigation_evidence(
    report_id: str,
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if user.role == UserRole.OFFICER:
        verify_assignment(report_id, str(user.id), db)
    elif user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    investigations = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .all()
    )

    evidence = None

    for investigation in investigations:
        for item in investigation.evidence_files or []:
            if item["stored_name"] == filename:
                evidence = item
                break

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found",
        )

    file_path = EVIDENCE_DIR / evidence["stored_name"]

    if not file_path.is_file() or file_path.parent != EVIDENCE_DIR:
        raise HTTPException(
            status_code=404,
            detail="Evidence file not found",
        )

    return FileResponse(
        path=file_path,
        media_type=evidence["content_type"],
        filename=evidence["original_name"],
        content_disposition_type="attachment",
    )

# Admin gets the latest investigation submitted by the local officer

@router.get("/admin/reports/{report_id}/investigation")
def get_admin_investigation(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if not investigation:
        return {"investigation": None}

    officer = (
        db.query(User)
        .filter(User.id == investigation.officer_id)
        .first()
    )

    return {
        "investigation": {
            "id": str(investigation.id),
            "findings": investigation.findings,
            "verification_result": investigation.verification_result,
            "action_taken": investigation.action_taken,
            "latitude": investigation.latitude,
            "longitude": investigation.longitude,
            "submitted_at": investigation.submitted_at,
            "officer": {
                "id": str(officer.id) if officer else None,
                "full_name": officer.full_name if officer else "Unknown officer",
                "username": officer.username if officer else "",
            },
            "evidence_files": [
                {
                    "stored_name": item["stored_name"],
                    "original_name": item["original_name"],
                    "content_type": item["content_type"],
                    "size": item["size"],
                }
                for item in (investigation.evidence_files or [])
            ],
        }
    }


# ==========================================
# NASHA MUKT REWARD MANAGEMENT
# ==========================================
'''
from decimal import Decimal, InvalidOperation
from app.models import RewardSetting, ReportReward


# Admin views the current reward amount
@router.get("/admin/rewards/settings")
def get_reward_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting:
        return {
            "configured": False,
            "amount": 0,
            "currency": "INR",
        }

    return {
        "configured": True,
        "amount": setting.amount_paise / 100,
        "currency": "INR",
        "updated_at": setting.updated_at,
    }


# Admin creates or updates the reward amount
@router.put("/admin/rewards/settings")
def update_reward_settings(
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    try:
        amount = Decimal(str(payload.get("amount")))

        if not amount.is_finite():
            raise ValueError()

        if amount < Decimal("1") or amount > Decimal("100000"):
            raise ValueError()

        if amount != amount.quantize(Decimal("0.01")):
            raise ValueError()

        amount_paise = int(amount * 100)

    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Reward amount must be between ₹1 and ₹100000, with at most two decimal places",
        )

    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting:
        setting = RewardSetting(
            id=1,
            amount_paise=amount_paise,
            updated_by=admin.id,
        )
        db.add(setting)
    else:
        setting.amount_paise = amount_paise
        setting.updated_by = admin.id

    try:
        db.commit()
        db.refresh(setting)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update reward amount",
        )

    return {
        "message": "Reward amount updated successfully",
        "amount": setting.amount_paise / 100,
        "currency": "INR",
    }


# Admin views reports eligible for rewards
@router.get("/admin/rewards/eligible")
def get_eligible_reward_reports(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    completed_reports = (
        db.query(Report)
        .filter(
            Report.status == ReportStatus.ACTION_COMPLETED
        )
        .order_by(desc(Report.created_at))
        .all()
    )

    already_rewarded = {
        row[0]
        for row in db.query(ReportReward.report_id).all()
    }

    eligible = []

    for report in completed_reports:
        if report.id in already_rewarded:
            continue

        eligible.append({
            "report_id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "category": report.category.value,
            "status": report.status.value,
            "completed_at": report.updated_at,
        })

    return {
        "count": len(eligible),
        "reports": eligible,
    }

# Admin grants a reward to an eligible report
@router.post("/admin/rewards/{report_id}/grant")
def grant_report_reward(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Find the report
    report = db.query(Report).filter(
        Report.id == report_id
    ).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    # Report must be completed
    if report.status != ReportStatus.ACTION_COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Only completed reports are eligible for rewards",
        )

    # Check the latest investigation
    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if (
        not investigation
        or investigation.verification_result != "verified"
    ):
        raise HTTPException(
            status_code=400,
            detail="A verified investigation is required",
        )

    # Check admin reward settings
    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting or setting.amount_paise < 100:
        raise HTTPException(
            status_code=400,
            detail="Admin must configure a valid reward amount first",
        )

    # Prevent duplicate rewards
    existing_reward = db.query(ReportReward).filter(
        ReportReward.report_id == report.id
    ).first()

    if existing_reward:
        raise HTTPException(
            status_code=409,
            detail="A reward has already been issued for this report",
        )

    # Generate a unique reward code
    reward_code = "NM-RWD-" + secrets.token_hex(16).upper()

    reward = ReportReward(
        report_id=report.id,
        amount_paise=setting.amount_paise,
        code_hash=hash_secret(reward_code),
        status="issued",
    )

    try:
        db.add(reward)
        db.commit()
        db.refresh(reward)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to grant reward",
        )

    # Show the plain code to admin only once
    return {
        "message": "Reward granted successfully",
        "reward_code": reward_code,
        "tracking_reference": report.tracking_reference,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "important": "Save this reward code. It will not be displayed again.",
    }
# Admin views issued rewards and payout statuses
@router.get("/admin/rewards")
def get_admin_rewards(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rewards = (
        db.query(ReportReward, Report)
        .join(Report, Report.id == ReportReward.report_id)
        .order_by(desc(ReportReward.issued_at))
        .all()
    )

    return [
        {
            "reward_id": str(reward.id),
            "report_id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "amount": reward.amount_paise / 100,
            "status": reward.status,
            "issued_at": reward.issued_at,
            "redeemed_at": reward.redeemed_at,
            "utr": reward.utr,
        }
        for reward, report in rewards
    ]

# ==========================================
# CITIZEN REWARD CODE GENERATION
# ==========================================

@router.post("/reports/rewards/issue-code")
def issue_citizen_reward_code(
    payload: dict,
    db: Session = Depends(get_db),
):
    reference = payload.get("tracking_reference", "").strip()
    tracking_secret = payload.get("tracking_secret", "")

    if not reference or not tracking_secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and tracking secret are required",
        )

    # Verify citizen report ownership.
    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(tracking_secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    # A reward is available only after the action is completed.
    if report.status != ReportStatus.ACTION_COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Your report is not yet eligible for a reward",
        )

    # Check the latest investigation is verified.
    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if (
        not investigation
        or investigation.verification_result != "verified"
    ):
        raise HTTPException(
            status_code=400,
            detail="A verified investigation is required for this reward",
        )

    # Check that admin has configured a reward amount.
    setting = (
        db.query(RewardSetting)
        .filter(RewardSetting.id == 1)
        .first()
    )

    if not setting:
        raise HTTPException(
            status_code=400,
            detail="Reward amount has not been configured by admin",
        )

    if setting.amount_paise < 100:
        raise HTTPException(
            status_code=400,
            detail="Configured reward amount is invalid",
        )

    # Prevent issuing multiple codes for one report.
    existing_reward = (
        db.query(ReportReward)
        .filter(ReportReward.report_id == report.id)
        .first()
    )

    if existing_reward:
        raise HTTPException(
            status_code=409,
            detail="A reward code has already been issued for this report. Please use your saved code.",
        )

    # Generate a high-entropy, unique reward code.
    reward_code = (
        "NM-RWD-"
        + secrets.token_hex(16).upper()
    )

    reward = ReportReward(
        report_id=report.id,
        amount_paise=setting.amount_paise,
        code_hash=hash_secret(reward_code),
        status="issued",
    )

    try:
        db.add(reward)
        db.commit()
        db.refresh(reward)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to issue reward code",
        )

    # The plain code is returned only once.
    return {
        "message": "Reward code generated successfully",
        "reward_code": reward_code,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "tracking_reference": report.tracking_reference,
        "important": "Save this code securely. It will not be displayed again.",
    }


# Citizen checks reward status using tracking credentials.
@router.post("/reports/rewards/status")
def get_citizen_reward_status(
    payload: dict,
    db: Session = Depends(get_db),
):
    reference = payload.get("tracking_reference", "").strip()
    tracking_secret = payload.get("tracking_secret", "")

    if not reference or not tracking_secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and tracking secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(tracking_secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    reward = (
        db.query(ReportReward)
        .filter(ReportReward.report_id == report.id)
        .first()
    )

    if not reward:
        return {
            "eligible": report.status == ReportStatus.ACTION_COMPLETED,
            "reward_issued": False,
            "report_status": report.status.value,
            "message": (
                "Your report is eligible for a reward."
                if report.status == ReportStatus.ACTION_COMPLETED
                else "Your report is not yet eligible for a reward."
            ),
        }

    return {
        "eligible": True,
        "reward_issued": True,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "issued_at": reward.issued_at,
        "message": "Your reward code has already been issued. Use your saved code to redeem it.",
    }


# ==========================================
# CITIZEN REDEEMS REWARD THROUGH UPI
# ==========================================

@router.post("/reports/rewards/redeem")
def redeem_reward(
    payload: dict,
    db: Session = Depends(get_db),
):
    # Validate required details.
    reward_code = str(payload.get("reward_code", "")).strip().upper()
    upi_id = str(payload.get("upi_id", "")).strip()
    beneficiary_name = str(
        payload.get("beneficiary_name", "")
    ).strip()

    if not reward_code or not upi_id or not beneficiary_name:
        raise HTTPException(
            status_code=400,
            detail="Reward code, UPI ID and beneficiary name are required",
        )

    # Validate UPI ID format.
    upi_pattern = r"^[A-Za-z0-9][A-Za-z0-9.-]{0,98}@[A-Za-z0-9.-]+$"

    if (
        len(upi_id) > 100
        or upi_id.count("@") != 1
        or not re.fullmatch(upi_pattern, upi_id)
    ):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid UPI ID",
        )

    # Validate beneficiary name.
    allowed_name_chars = set(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        " .'’_-/()"
    )

    if (
        len(beneficiary_name) < 3
        or len(beneficiary_name) > 50
        or not all(char in allowed_name_chars for char in beneficiary_name)
    ):
        raise HTTPException(
            status_code=400,
            detail="Beneficiary name must contain 3 to 50 valid characters",
        )

    # Check RazorpayX configuration.
    if not settings.RAZORPAYX_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Reward payouts are temporarily unavailable",
        )

    if not all([
        settings.RAZORPAYX_KEY_ID,
        settings.RAZORPAYX_KEY_SECRET,
        settings.RAZORPAYX_ACCOUNT_NUMBER,
    ]):
        raise HTTPException(
            status_code=503,
            detail="Payment provider configuration is incomplete",
        )

    # Lock the reward row to prevent simultaneous redemption.
    reward = (
        db.query(ReportReward)
        .filter(
            ReportReward.code_hash == hash_secret(reward_code)
        )
        .with_for_update()
        .first()
    )

    if not reward:
        raise HTTPException(
            status_code=404,
            detail="Invalid reward code",
        )

    if reward.status != "issued":
        raise HTTPException(
            status_code=409,
            detail=f"This reward code cannot be redeemed. Current status: {reward.status}",
        )

    report = db.query(Report).filter(
        Report.id == reward.report_id
    ).first()

    if not report or report.status != ReportStatus.ACTION_COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="This report is no longer eligible for a reward",
        )

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if (
        not investigation
        or investigation.verification_result != "verified"
    ):
        raise HTTPException(
            status_code=400,
            detail="A verified investigation is required",
        )

    # Create and persist a unique reference before contacting Razorpay.
    payout_reference = str(uuid.uuid4())

    reward.status = "processing"
    reward.provider_reference = payout_reference
    reward.redeemed_at = datetime.now(timezone.utc)

    # Store only a masked UPI ID in our database.
    vpa_user, vpa_handle = upi_id.split("@", 1)
    masked_user = (
        vpa_user[:2] + "***"
        if len(vpa_user) > 2
        else "*"
    )
    reward.upi_id_masked = f"{masked_user}@{vpa_handle}"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to start reward redemption",
        )

    # Create RazorpayX composite UPI payout.
    # No phone number is sent.
    payout_payload = {
        "account_number": settings.RAZORPAYX_ACCOUNT_NUMBER,
        "amount": reward.amount_paise,
        "currency": "INR",
        "mode": "UPI",
        "purpose": "payout",
        "fund_account": {
            "account_type": "vpa",
            "vpa": {
                "address": upi_id,
            },
            "contact": {
                "name": beneficiary_name,
                "type": "customer",
            },
        },
        "queue_if_low_balance": True,
        "reference_id": payout_reference,
        "narration": "NashaMukt Reward",
        "notes": {
            "report_reference": report.tracking_reference,
        },
    }

    try:
        response = requests.post(
            "https://api.razorpay.com/v1/payouts",
            auth=(
                settings.RAZORPAYX_KEY_ID,
                settings.RAZORPAYX_KEY_SECRET,
            ),
            headers={
                "Content-Type": "application/json",
                "X-Payout-Idempotency": payout_reference,
            },
            json=payout_payload,
            timeout=(5, 30),
        )

        if response.status_code >= 400:
            if response.status_code < 500:
                reward.status = "failed"
                db.commit()

            raise HTTPException(
                status_code=502,
                detail=(
                    "The payment provider rejected the payout. "
                    "Please contact the administrator."
                    if response.status_code < 500
                    else
                    "Payout status could not be confirmed. "
                    "Do not retry this code; contact the administrator."
                ),
            )

        payout_data = response.json()

    except requests.RequestException:
        # Do not issue another payout automatically after a network error.
        # The provider may have received the original request.
        raise HTTPException(
            status_code=502,
            detail=(
                "Payout status could not be confirmed. "
                "Do not retry this code; contact the administrator."
            ),
        )

    except ValueError:
        # An unreadable response does not prove that no payout happened.
        raise HTTPException(
            status_code=502,
            detail=(
                "Payout status could not be confirmed. "
                "Contact the administrator before taking further action."
            ),
        )

    # Save the provider response.
    reward.provider_payout_id = payout_data.get("id")

    provider_status = payout_data.get("status", "processing")

    if provider_status == "processed":
        reward.status = "paid"
    elif provider_status in ["queued", "pending", "processing"]:
        reward.status = provider_status
    elif provider_status in [
        "failed",
        "rejected",
        "reversed",
        "cancelled",
    ]:
        reward.status = "failed"
    else:
        reward.status = "processing"

    reward.utr = payout_data.get("utr")

    try:
        db.commit()
        db.refresh(reward)
    except Exception:
        db.rollback()
        # The provider may already have accepted the payout.
        # Reconcile by payout_reference; do not initiate a second transfer.
        raise HTTPException(
            status_code=502,
            detail="Payout was submitted, but local status could not be saved. Contact the administrator.",
        )

    return {
        "message": (
            "Reward payment completed"
            if reward.status == "paid"
            else "Reward payout submitted. Check the status for updates."
        ),
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "payout_id": reward.provider_payout_id,
        "utr": reward.utr,
        "upi_id": reward.upi_id_masked,
    }

# ==========================================
# RAZORPAYX WEBHOOK
# ==========================================

@router.post("/webhooks/razorpayx")
async def razorpayx_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    webhook_secret = settings.RAZORPAYX_WEBHOOK_SECRET

    if not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook secret is not configured",
        )

    # Verify the signature against the original request bytes.
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not signature or not hmac.compare_digest(
        expected_signature,
        signature,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook signature",
        )

    try:
        event_data = json.loads(raw_body)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook JSON",
        )

    event_type = event_data.get("event", "")

    # Ignore events unrelated to payouts.
    if not event_type.startswith("payout."):
        return {"received": True, "updated": False}

    payout_data = (
        event_data.get("payload", {})
        .get("payout", {})
        .get("entity", {})
    )

    if not isinstance(payout_data, dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid payout event payload",
        )

    payout_id = payout_data.get("id")
    payout_reference = payout_data.get("reference_id")

    if not payout_id and not payout_reference:
        raise HTTPException(
            status_code=400,
            detail="Payout reference is missing",
        )

    # Locate the reward associated with this payout.
    query = db.query(ReportReward)

    if payout_id and payout_reference:
        query = query.filter(
            (ReportReward.provider_payout_id == payout_id)
            | (ReportReward.provider_reference == payout_reference)
        )
    elif payout_id:
        query = query.filter(
            ReportReward.provider_payout_id == payout_id
        )
    else:
        query = query.filter(
            ReportReward.provider_reference == payout_reference
        )

    reward = query.with_for_update().first()

    # A valid event for a payout that is not in our database
    # must not change any reward.
    if not reward:
        return {"received": True, "updated": False}

    # Process events that may arrive out of order.
    event_statuses = {
        "payout.pending": "pending",
        "payout.queued": "queued",
        "payout.initiated": "processing",
        "payout.processed": "paid",
        "payout.reversed": "reversed",
        "payout.failed": "failed",
        "payout.rejected": "failed",
        "payout.cancelled": "failed",
    }

    if event_type == "payout.updated":
        provider_status = payout_data.get("status", "")
    else:
        provider_status = event_statuses.get(event_type, "")

    status_mapping = {
        "pending": "pending",
        "queued": "queued",
        "processing": "processing",
        "processed": "paid",
        "reversed": "reversed",
        "failed": "failed",
        "rejected": "failed",
        "cancelled": "failed",
    }

    new_status = status_mapping.get(provider_status)

    if not new_status:
        return {"received": True, "updated": False}

    # Do not allow a later duplicate or older event to
    # overwrite a final payout result.
    final_statuses = {"paid", "reversed", "failed"}

    if reward.status in final_statuses:
        return {
            "received": True,
            "updated": False,
            "status": reward.status,
        }

    status_rank = {
        "issued": 0,
        "pending": 1,
        "queued": 2,
        "processing": 3,
        "paid": 4,
        "reversed": 4,
        "failed": 4,
    }

    if status_rank.get(new_status, 0) < status_rank.get(
        reward.status, 0
    ):
        return {
            "received": True,
            "updated": False,
            "status": reward.status,
        }

    reward.status = new_status

    if payout_id:
        reward.provider_payout_id = payout_id

    if payout_data.get("utr"):
        reward.utr = payout_data["utr"]

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update payout status",
        )

    return {
        "received": True,
        "updated": True,
        "status": reward.status,
    }


# ==========================================
# CITIZEN CHECKS FINAL PAYMENT STATUS
# ==========================================

@router.post("/reports/rewards/payment-status")
def get_reward_payment_status(
    payload: dict,
    db: Session = Depends(get_db),
):
    reference = str(
        payload.get("tracking_reference", "")
    ).strip()

    tracking_secret = str(
        payload.get("tracking_secret", "")
    )

    if not reference or not tracking_secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and tracking secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(tracking_secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    reward = (
        db.query(ReportReward)
        .filter(ReportReward.report_id == report.id)
        .first()
    )

    if not reward:
        return {
            "reward_issued": False,
            "report_status": report.status.value,
            "message": "No reward has been issued for this report.",
        }

    messages = {
        "issued": "Your reward code is ready to redeem.",
        "processing": "Your payout is being processed.",
        "pending": "Your payout is awaiting approval.",
        "queued": "Your payout is queued.",
        "paid": "Your reward has been successfully paid.",
        "failed": "Your payout failed. Please contact the administrator.",
        "reversed": "Your payout was reversed. Please contact the administrator.",
    }

    return {
        "reward_issued": True,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "upi_id": reward.upi_id_masked,
        "utr": reward.utr,
        "issued_at": reward.issued_at,
        "redeemed_at": reward.redeemed_at,
        "message": messages.get(
            reward.status,
            "Please check your reward status again.",
        ),
    }
'''

import os
import uuid
import hashlib
import secrets
import hmac
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import Request
from app.models import ReportReward
from app.config import settings
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)
import re
import requests
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc
from jose import jwt, JWTError

from app.config import settings
from app.database import get_db
from app.models import (
    User,
    UserRole,
    Report,
    ReportAssignment,
    Investigation,
    ReportCategory,
    ReportStatus,
    ReportPriority,
    RewardSetting,
    ReportReward,
)

router = APIRouter()
security = HTTPBearer()

JWT_SECRET_KEY = settings.JWT_SECRET_KEY
JWT_ALGORITHM = settings.JWT_ALGORITHM

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend .env")

BASE_DIR = Path(__file__).resolve().parent.parent
EVIDENCE_DIR = BASE_DIR / "private_evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_FILES = 5

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
}


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.id == user_id).first()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User not found or inactive",
            )

        return user

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )


def require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return user


def require_officer(user: User = Depends(get_current_user)):
    if user.role != UserRole.OFFICER:
        raise HTTPException(
            status_code=403,
            detail="Officer access required",
        )
    return user


def verify_assignment(report_id: str, officer_id: str, db: Session):
    assignment = (
        db.query(ReportAssignment)
        .filter(
            ReportAssignment.report_id == report_id,
            ReportAssignment.officer_id == officer_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="This report is not assigned to you",
        )

    return assignment


async def validate_and_save_file(file: UploadFile):
    content_type = file.content_type

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}",
        )

    extension = ALLOWED_TYPES[content_type]
    content = await file.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Empty file uploaded",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Each file must be 20 MB or smaller",
        )

    valid_signature = False

    if content_type == "image/jpeg":
        valid_signature = content.startswith(b"\xff\xd8\xff")

    elif content_type == "image/png":
        valid_signature = content.startswith(b"\x89PNG\r\n\x1a\n")

    elif content_type == "image/webp":
        valid_signature = (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        )

    elif content_type in ["video/mp4", "video/quicktime"]:
        valid_signature = (
            len(content) >= 12
            and content[4:8] == b"ftyp"
        )

    if not valid_signature:
        raise HTTPException(
            status_code=400,
            detail="File content does not match its declared type",
        )

    stored_name = f"{uuid.uuid4().hex}{extension}"
    file_path = EVIDENCE_DIR / stored_name

    with open(file_path, "wb") as output:
        output.write(content)

    return {
        "stored_name": stored_name,
        "original_name": Path(file.filename or "evidence").name,
        "content_type": content_type,
        "size": len(content),
    }


# Citizen submits an anonymous report

@router.post("/reports")
def create_report(payload: dict, db: Session = Depends(get_db)):
    required_fields = [
        "category",
        "description",
        "location_text",
        "observed_frequency",
        "incident_datetime",
    ]

    for field in required_fields:
        if not payload.get(field):
            raise HTTPException(
                status_code=400,
                detail=f"{field} is required",
            )

    if len(payload["description"].strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Description must contain at least 20 characters",
        )

    latitude = payload.get("latitude")
    longitude = payload.get("longitude")

    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be provided together",
        )

    if latitude is not None:
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid GPS coordinates",
            )

        if not -90 <= latitude <= 90:
            raise HTTPException(
                status_code=400,
                detail="Latitude must be between -90 and 90",
            )

        if not -180 <= longitude <= 180:
            raise HTTPException(
                status_code=400,
                detail="Longitude must be between -180 and 180",
            )

    try:
        category = ReportCategory(payload["category"])
        incident_datetime = datetime.fromisoformat(
            payload["incident_datetime"].replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid category or date",
        )

    tracking_reference = f"NM-{secrets.token_hex(5).upper()}"
    tracking_secret = secrets.token_urlsafe(24)

    report = Report(
        tracking_reference=tracking_reference,
        tracking_secret_hash=hash_secret(tracking_secret),
        category=category,
        description=payload["description"].strip(),
        location_text=payload["location_text"].strip(),
        latitude=latitude,
        longitude=longitude,
        observed_frequency=payload["observed_frequency"],
        observed_quantity=payload.get("observed_quantity"),
        incident_datetime=incident_datetime,
        status=ReportStatus.SUBMITTED,
        priority=ReportPriority.MEDIUM,
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "message": "Report submitted successfully",
        "tracking_reference": tracking_reference,
        "tracking_secret": tracking_secret,
        "status": report.status.value,
    }


# Citizen tracks a report without logging in

@router.post("/reports/track")
def track_report(payload: dict, db: Session = Depends(get_db)):
    reference = payload.get("tracking_reference")
    secret = payload.get("tracking_secret")

    if not reference or not secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    return {
        "tracking_reference": report.tracking_reference,
        "category": report.category.value,
        "status": report.status.value,
        "priority": report.priority.value,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


# Admin and officer login

@router.post("/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    from pwdlib import PasswordHash

    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password required",
        )

    user = db.query(User).filter(User.username == username).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    password_hasher = PasswordHash.recommended()

    if not password_hasher.verify(password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.value,
        "username": user.username,
    }


# Admin views all reports

@router.get("/admin/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    reports = db.query(Report).order_by(desc(Report.created_at)).all()

    return [
        {
            "id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "category": report.category.value,
            "description": report.description,
            "location_text": report.location_text,
            "priority": report.priority.value,
            "status": report.status.value,
            "created_at": report.created_at,
        }
        for report in reports
    ]


# Admin views officers

@router.get("/admin/officers")
def get_officers(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    officers = (
        db.query(User)
        .filter(
            User.role == UserRole.OFFICER,
            User.is_active.is_(True),
        )
        .all()
    )

    return [
        {
            "id": str(officer.id),
            "full_name": officer.full_name,
            "username": officer.username,
        }
        for officer in officers
    ]


# Admin assigns report to officer

@router.post("/admin/reports/{report_id}/assign")
def assign_report(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    officer_id = payload.get("officer_id")
    deadline = payload.get("deadline")

    if not officer_id or not deadline:
        raise HTTPException(
            status_code=400,
            detail="Officer ID and deadline are required",
        )

    officer = (
        db.query(User)
        .filter(
            User.id == officer_id,
            User.role == UserRole.OFFICER,
            User.is_active.is_(True),
        )
        .first()
    )

    if not officer:
        raise HTTPException(
            status_code=404,
            detail="Officer not found",
        )

    try:
        deadline_value = datetime.fromisoformat(
            deadline.replace("Z", "+00:00")
        )
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid deadline",
        )

    assignment = ReportAssignment(
        report_id=report.id,
        officer_id=officer.id,
        assigned_by=admin.id,
        deadline=deadline_value,
    )

    report.status = ReportStatus.ASSIGNED

    db.add(assignment)
    db.commit()

    return {"message": "Report assigned successfully"}


# Officer views assigned reports

@router.get("/officer/assignments")
def get_officer_assignments(
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
):
    assignments = (
        db.query(ReportAssignment)
        .filter(ReportAssignment.officer_id == officer.id)
        .order_by(desc(ReportAssignment.assigned_at))
        .all()
    )

    results = []

    for assignment in assignments:
        report = assignment.report

        results.append({
            "assignment_id": str(assignment.id),
            "report_id": str(report.id),
            "category": report.category.value,
            "description": report.description,
            "location_text": report.location_text,
            "priority": report.priority.value,
            "status": report.status.value,
            "deadline": assignment.deadline,
        })

    return results


# Officer submits investigation with GPS and optional photo/video evidence

@router.post("/officer/reports/{report_id}/investigation")
async def submit_investigation(
    report_id: str,
    findings: str = Form(...),
    verification_result: str = Form(...),
    action_taken: str = Form(""),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    officer: User = Depends(require_officer),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    verify_assignment(report_id, str(officer.id), db)

    if report.status not in [
        ReportStatus.ASSIGNED,
        ReportStatus.INVESTIGATION_IN_PROGRESS,
    ]:
        raise HTTPException(
            status_code=400,
            detail="This report cannot accept an investigation submission",
        )

    if len(findings.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Investigation findings must contain at least 20 characters",
        )

    if verification_result not in [
        "verified",
        "false",
        "inconclusive",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Verification result must be verified, false, or inconclusive",
        )

    # Validate officer GPS coordinates

    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=400,
            detail="Officer latitude and longitude must be provided together",
        )

    if latitude is not None:
        if not -90 <= latitude <= 90:
            raise HTTPException(
                status_code=400,
                detail="Latitude must be between -90 and 90",
            )

        if not -180 <= longitude <= 180:
            raise HTTPException(
                status_code=400,
                detail="Longitude must be between -180 and 180",
            )

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"You can upload a maximum of {MAX_FILES} files",
        )

    saved_files = []

    try:
        for file in files:
            saved_file = await validate_and_save_file(file)
            saved_files.append(saved_file)

        investigation = Investigation(
            report_id=report.id,
            officer_id=officer.id,
            findings=findings.strip(),
            verification_result=verification_result,
            action_taken=action_taken.strip() or None,
            latitude=latitude,
            longitude=longitude,
            evidence_files=saved_files,
        )

        report.status = ReportStatus.INVESTIGATION_SUBMITTED

        db.add(investigation)
        db.commit()

    except Exception:
        db.rollback()

        for saved_file in saved_files:
            file_path = EVIDENCE_DIR / saved_file["stored_name"]

            if file_path.exists():
                file_path.unlink()

        raise

    return {
        "message": "Investigation submitted successfully",
        "status": report.status.value,
        "uploaded_files": len(saved_files),
        "latitude": latitude,
        "longitude": longitude,
    }


# Admin reviews officer investigation

@router.post("/admin/reports/{report_id}/review")
def review_investigation(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if report.status != ReportStatus.INVESTIGATION_SUBMITTED:
        raise HTTPException(
            status_code=400,
            detail="Investigation has not been submitted",
        )

    decision = payload.get("decision")

    if decision not in [
        "approved",
        "rejected",
        "inconclusive",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Decision must be approved, rejected, or inconclusive",
        )

    if decision == "approved":
        report.status = ReportStatus.ADMIN_VERIFICATION
    elif decision == "rejected":
        report.status = ReportStatus.REJECTED
    else:
        report.status = ReportStatus.INCONCLUSIVE

    db.commit()

    return {
        "message": "Investigation reviewed",
        "status": report.status.value,
    }


# Admin completes verified action

@router.post("/admin/reports/{report_id}/complete")
def complete_report(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if report.status != ReportStatus.ADMIN_VERIFICATION:
        raise HTTPException(
            status_code=400,
            detail="Only reports under admin verification can be completed",
        )

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if not investigation or investigation.verification_result != "verified":
        raise HTTPException(
            status_code=400,
            detail="Only verified investigations can be completed",
        )

    report.status = ReportStatus.ACTION_COMPLETED
    db.commit()

    return {
        "message": "Report marked as action completed",
        "status": report.status.value,
    }


# Admin and assigned officer can access investigation evidence

@router.get("/reports/{report_id}/evidence/{filename}")
def get_investigation_evidence(
    report_id: str,
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    if user.role == UserRole.OFFICER:
        verify_assignment(report_id, str(user.id), db)
    elif user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    investigations = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .all()
    )

    evidence = None

    for investigation in investigations:
        for item in investigation.evidence_files or []:
            if item["stored_name"] == filename:
                evidence = item
                break

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found",
        )

    file_path = EVIDENCE_DIR / evidence["stored_name"]

    if not file_path.is_file() or file_path.parent != EVIDENCE_DIR:
        raise HTTPException(
            status_code=404,
            detail="Evidence file not found",
        )

    return FileResponse(
        path=file_path,
        media_type=evidence["content_type"],
        filename=evidence["original_name"],
        content_disposition_type="attachment",
    )

# Admin gets the latest investigation submitted by the local officer

@router.get("/admin/reports/{report_id}/investigation")
def get_admin_investigation(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if not investigation:
        return {"investigation": None}

    officer = (
        db.query(User)
        .filter(User.id == investigation.officer_id)
        .first()
    )

    return {
        "investigation": {
            "id": str(investigation.id),
            "findings": investigation.findings,
            "verification_result": investigation.verification_result,
            "action_taken": investigation.action_taken,
            "latitude": investigation.latitude,
            "longitude": investigation.longitude,
            "submitted_at": investigation.submitted_at,
            "officer": {
                "id": str(officer.id) if officer else None,
                "full_name": officer.full_name if officer else "Unknown officer",
                "username": officer.username if officer else "",
            },
            "evidence_files": [
                {
                    "stored_name": item["stored_name"],
                    "original_name": item["original_name"],
                    "content_type": item["content_type"],
                    "size": item["size"],
                }
                for item in (investigation.evidence_files or [])
            ],
        }
    }


# ==========================================
# NASHA MUKT REWARD MANAGEMENT
# ==========================================

from decimal import Decimal, InvalidOperation
from app.models import RewardSetting, ReportReward


# Admin views the current reward amount
@router.get("/admin/rewards/settings")
def get_reward_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting:
        return {
            "configured": False,
            "amount": 0,
            "currency": "INR",
        }

    return {
        "configured": True,
        "amount": setting.amount_paise / 100,
        "currency": "INR",
        "updated_at": setting.updated_at,
    }


# Admin creates or updates the reward amount
@router.put("/admin/rewards/settings")
def update_reward_settings(
    payload: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    try:
        amount = Decimal(str(payload.get("amount")))

        if not amount.is_finite():
            raise ValueError()

        if amount < Decimal("1") or amount > Decimal("100000"):
            raise ValueError()

        if amount != amount.quantize(Decimal("0.01")):
            raise ValueError()

        amount_paise = int(amount * 100)

    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Reward amount must be between ₹1 and ₹100000, with at most two decimal places",
        )

    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting:
        setting = RewardSetting(
            id=1,
            amount_paise=amount_paise,
            updated_by=admin.id,
        )
        db.add(setting)
    else:
        setting.amount_paise = amount_paise
        setting.updated_by = admin.id

    try:
        db.commit()
        db.refresh(setting)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update reward amount",
        )

    return {
        "message": "Reward amount updated successfully",
        "amount": setting.amount_paise / 100,
        "currency": "INR",
    }


# Admin views reports eligible for rewards
@router.get("/admin/rewards/eligible")
def get_eligible_reward_reports(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    completed_reports = (
        db.query(Report)
        .filter(
            Report.status == ReportStatus.ACTION_COMPLETED
        )
        .order_by(desc(Report.created_at))
        .all()
    )

    already_rewarded = {
        row[0]
        for row in db.query(ReportReward.report_id).all()
    }

    eligible = []

    for report in completed_reports:
        if report.id in already_rewarded:
            continue

        eligible.append({
            "report_id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "category": report.category.value,
            "status": report.status.value,
            "completed_at": report.updated_at,
        })

    return {
        "count": len(eligible),
        "reports": eligible,
    }

# Admin grants a reward to an eligible report
@router.post("/admin/rewards/{report_id}/grant")
def grant_report_reward(
    report_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Find the report
    report = db.query(Report).filter(
        Report.id == report_id
    ).first()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Report not found",
        )

    # Report must be completed
    if report.status != ReportStatus.ACTION_COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Only completed reports are eligible for rewards",
        )

    # Check the latest investigation
    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if (
        not investigation
        or investigation.verification_result != "verified"
    ):
        raise HTTPException(
            status_code=400,
            detail="A verified investigation is required",
        )

    # Check admin reward settings
    setting = db.query(RewardSetting).filter(
        RewardSetting.id == 1
    ).first()

    if not setting or setting.amount_paise < 100:
        raise HTTPException(
            status_code=400,
            detail="Admin must configure a valid reward amount first",
        )

    # Prevent duplicate rewards
    existing_reward = db.query(ReportReward).filter(
        ReportReward.report_id == report.id
    ).first()

    if existing_reward:
        raise HTTPException(
            status_code=409,
            detail="A reward has already been issued for this report",
        )

    # Generate a unique reward code
    reward_code = "NM-RWD-" + secrets.token_hex(16).upper()

    reward = ReportReward(
        report_id=report.id,
        amount_paise=setting.amount_paise,
        code_hash=hash_secret(reward_code),
        status="issued",
    )

    try:
        db.add(reward)
        db.commit()
        db.refresh(reward)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to grant reward",
        )

    # Show the plain code to admin only once
    return {
        "message": "Reward granted successfully",
        "reward_code": reward_code,
        "tracking_reference": report.tracking_reference,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "important": "Save this reward code. It will not be displayed again.",
    }
# Admin views issued rewards and payout statuses
@router.get("/admin/rewards")
def get_admin_rewards(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rewards = (
        db.query(ReportReward, Report)
        .join(Report, Report.id == ReportReward.report_id)
        .order_by(desc(ReportReward.issued_at))
        .all()
    )

    return [
        {
            "reward_id": str(reward.id),
            "report_id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "amount": reward.amount_paise / 100,
            "status": reward.status,
            "issued_at": reward.issued_at,
            "redeemed_at": reward.redeemed_at,
            "utr": reward.utr,
        }
        for reward, report in rewards
    ]

# Citizen checks reward status using tracking credentials.
@router.post("/reports/rewards/status")
def get_citizen_reward_status(
    payload: dict,
    db: Session = Depends(get_db),
):
    reference = payload.get("tracking_reference", "").strip()
    tracking_secret = payload.get("tracking_secret", "")

    if not reference or not tracking_secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and tracking secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(tracking_secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    reward = (
        db.query(ReportReward)
        .filter(ReportReward.report_id == report.id)
        .first()
    )

    if not reward:
        return {
            "eligible": report.status == ReportStatus.ACTION_COMPLETED,
            "reward_issued": False,
            "report_status": report.status.value,
            "message": (
    "Your report is eligible. Waiting for the administrator to grant your reward."
    if report.status == ReportStatus.ACTION_COMPLETED
    else "Your report is not yet eligible for a reward."
),
        }

    return {
        "eligible": True,
        "reward_issued": True,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "issued_at": reward.issued_at,
        "message": "Your reward code has already been issued. Use your saved code to redeem it.",
    }


# ==========================================
# CITIZEN REDEEMS REWARD THROUGH UPI
# ==========================================

@router.post("/reports/rewards/redeem")
def redeem_reward(
    payload: dict,
    db: Session = Depends(get_db),
):
    # Validate required details.
    reward_code = str(payload.get("reward_code", "")).strip().upper()
    upi_id = str(payload.get("upi_id", "")).strip()
    beneficiary_name = str(
        payload.get("beneficiary_name", "")
    ).strip()

    if not reward_code or not upi_id or not beneficiary_name:
        raise HTTPException(
            status_code=400,
            detail="Reward code, UPI ID and beneficiary name are required",
        )

    # Validate UPI ID format.
    upi_pattern = r"^[A-Za-z0-9][A-Za-z0-9.-]{0,98}@[A-Za-z0-9.-]+$"

    if (
        len(upi_id) > 100
        or upi_id.count("@") != 1
        or not re.fullmatch(upi_pattern, upi_id)
    ):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid UPI ID",
        )

    # Validate beneficiary name.
    allowed_name_chars = set(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        " .'’_-/()"
    )

    if (
        len(beneficiary_name) < 3
        or len(beneficiary_name) > 50
        or not all(char in allowed_name_chars for char in beneficiary_name)
    ):
        raise HTTPException(
            status_code=400,
            detail="Beneficiary name must contain 3 to 50 valid characters",
        )

    # Check RazorpayX configuration.
    if not settings.RAZORPAYX_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Reward payouts are temporarily unavailable",
        )

    if not all([
        settings.RAZORPAYX_KEY_ID,
        settings.RAZORPAYX_KEY_SECRET,
        settings.RAZORPAYX_ACCOUNT_NUMBER,
    ]):
        raise HTTPException(
            status_code=503,
            detail="Payment provider configuration is incomplete",
        )

    # Lock the reward row to prevent simultaneous redemption.
    reward = (
        db.query(ReportReward)
        .filter(
            ReportReward.code_hash == hash_secret(reward_code)
        )
        .with_for_update()
        .first()
    )

    if not reward:
        raise HTTPException(
            status_code=404,
            detail="Invalid reward code",
        )

    if reward.status != "issued":
        raise HTTPException(
            status_code=409,
            detail=f"This reward code cannot be redeemed. Current status: {reward.status}",
        )

    report = db.query(Report).filter(
        Report.id == reward.report_id
    ).first()

    if not report or report.status != ReportStatus.ACTION_COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="This report is no longer eligible for a reward",
        )

    investigation = (
        db.query(Investigation)
        .filter(Investigation.report_id == report.id)
        .order_by(desc(Investigation.submitted_at))
        .first()
    )

    if (
        not investigation
        or investigation.verification_result != "verified"
    ):
        raise HTTPException(
            status_code=400,
            detail="A verified investigation is required",
        )

    # Create and persist a unique reference before contacting Razorpay.
    payout_reference = str(uuid.uuid4())

    reward.status = "processing"
    reward.provider_reference = payout_reference
    reward.redeemed_at = datetime.now(timezone.utc)

    # Store only a masked UPI ID in our database.
    vpa_user, vpa_handle = upi_id.split("@", 1)
    masked_user = (
        vpa_user[:2] + "***"
        if len(vpa_user) > 2
        else "*"
    )
    reward.upi_id_masked = f"{masked_user}@{vpa_handle}"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to start reward redemption",
        )

    # Create RazorpayX composite UPI payout.
    # No phone number is sent.
    payout_payload = {
        "account_number": settings.RAZORPAYX_ACCOUNT_NUMBER,
        "amount": reward.amount_paise,
        "currency": "INR",
        "mode": "UPI",
        "purpose": "payout",
        "fund_account": {
            "account_type": "vpa",
            "vpa": {
                "address": upi_id,
            },
            "contact": {
                "name": beneficiary_name,
                "type": "customer",
            },
        },
        "queue_if_low_balance": True,
        "reference_id": payout_reference,
        "narration": "NashaMukt Reward",
        "notes": {
            "report_reference": report.tracking_reference,
        },
    }

    try:
        response = requests.post(
            "https://api.razorpay.com/v1/payouts",
            auth=(
                settings.RAZORPAYX_KEY_ID,
                settings.RAZORPAYX_KEY_SECRET,
            ),
            headers={
                "Content-Type": "application/json",
                "X-Payout-Idempotency": payout_reference,
            },
            json=payout_payload,
            timeout=(5, 30),
        )

        if response.status_code >= 400:
            if response.status_code < 500:
                reward.status = "failed"
                db.commit()

            raise HTTPException(
                status_code=502,
                detail=(
                    "The payment provider rejected the payout. "
                    "Please contact the administrator."
                    if response.status_code < 500
                    else
                    "Payout status could not be confirmed. "
                    "Do not retry this code; contact the administrator."
                ),
            )

        payout_data = response.json()

    except requests.RequestException:
        # Do not issue another payout automatically after a network error.
        # The provider may have received the original request.
        raise HTTPException(
            status_code=502,
            detail=(
                "Payout status could not be confirmed. "
                "Do not retry this code; contact the administrator."
            ),
        )

    except ValueError:
        # An unreadable response does not prove that no payout happened.
        raise HTTPException(
            status_code=502,
            detail=(
                "Payout status could not be confirmed. "
                "Contact the administrator before taking further action."
            ),
        )

    # Save the provider response.
    reward.provider_payout_id = payout_data.get("id")

    provider_status = payout_data.get("status", "processing")

    if provider_status == "processed":
        reward.status = "paid"
    elif provider_status in ["queued", "pending", "processing"]:
        reward.status = provider_status
    elif provider_status in [
        "failed",
        "rejected",
        "reversed",
        "cancelled",
    ]:
        reward.status = "failed"
    else:
        reward.status = "processing"

    reward.utr = payout_data.get("utr")

    try:
        db.commit()
        db.refresh(reward)
    except Exception:
        db.rollback()
        # The provider may already have accepted the payout.
        # Reconcile by payout_reference; do not initiate a second transfer.
        raise HTTPException(
            status_code=502,
            detail="Payout was submitted, but local status could not be saved. Contact the administrator.",
        )

    return {
        "message": (
            "Reward payment completed"
            if reward.status == "paid"
            else "Reward payout submitted. Check the status for updates."
        ),
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "payout_id": reward.provider_payout_id,
        "utr": reward.utr,
        "upi_id": reward.upi_id_masked,
    }

# ==========================================
# RAZORPAYX WEBHOOK
# ==========================================

@router.post("/webhooks/razorpayx")
async def razorpayx_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    webhook_secret = settings.RAZORPAYX_WEBHOOK_SECRET

    if not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook secret is not configured",
        )

    # Verify the signature against the original request bytes.
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not signature or not hmac.compare_digest(
        expected_signature,
        signature,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook signature",
        )

    try:
        event_data = json.loads(raw_body)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook JSON",
        )

    event_type = event_data.get("event", "")

    # Ignore events unrelated to payouts.
    if not event_type.startswith("payout."):
        return {"received": True, "updated": False}

    payout_data = (
        event_data.get("payload", {})
        .get("payout", {})
        .get("entity", {})
    )

    if not isinstance(payout_data, dict):
        raise HTTPException(
            status_code=400,
            detail="Invalid payout event payload",
        )

    payout_id = payout_data.get("id")
    payout_reference = payout_data.get("reference_id")

    if not payout_id and not payout_reference:
        raise HTTPException(
            status_code=400,
            detail="Payout reference is missing",
        )

    # Locate the reward associated with this payout.
    query = db.query(ReportReward)

    if payout_id and payout_reference:
        query = query.filter(
            (ReportReward.provider_payout_id == payout_id)
            | (ReportReward.provider_reference == payout_reference)
        )
    elif payout_id:
        query = query.filter(
            ReportReward.provider_payout_id == payout_id
        )
    else:
        query = query.filter(
            ReportReward.provider_reference == payout_reference
        )

    reward = query.with_for_update().first()

    # A valid event for a payout that is not in our database
    # must not change any reward.
    if not reward:
        return {"received": True, "updated": False}

    # Process events that may arrive out of order.
    event_statuses = {
        "payout.pending": "pending",
        "payout.queued": "queued",
        "payout.initiated": "processing",
        "payout.processed": "paid",
        "payout.reversed": "reversed",
        "payout.failed": "failed",
        "payout.rejected": "failed",
        "payout.cancelled": "failed",
    }

    if event_type == "payout.updated":
        provider_status = payout_data.get("status", "")
    else:
        provider_status = event_statuses.get(event_type, "")

    status_mapping = {
        "pending": "pending",
        "queued": "queued",
        "processing": "processing",
        "processed": "paid",
        "reversed": "reversed",
        "failed": "failed",
        "rejected": "failed",
        "cancelled": "failed",
    }

    new_status = status_mapping.get(provider_status)

    if not new_status:
        return {"received": True, "updated": False}

    # Do not allow a later duplicate or older event to
    # overwrite a final payout result.
    final_statuses = {"paid", "reversed", "failed"}

    if reward.status in final_statuses:
        return {
            "received": True,
            "updated": False,
            "status": reward.status,
        }

    status_rank = {
        "issued": 0,
        "pending": 1,
        "queued": 2,
        "processing": 3,
        "paid": 4,
        "reversed": 4,
        "failed": 4,
    }

    if status_rank.get(new_status, 0) < status_rank.get(
        reward.status, 0
    ):
        return {
            "received": True,
            "updated": False,
            "status": reward.status,
        }

    reward.status = new_status

    if payout_id:
        reward.provider_payout_id = payout_id

    if payout_data.get("utr"):
        reward.utr = payout_data["utr"]

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update payout status",
        )

    return {
        "received": True,
        "updated": True,
        "status": reward.status,
    }


# ==========================================
# CITIZEN CHECKS FINAL PAYMENT STATUS
# ==========================================

@router.post("/reports/rewards/payment-status")
def get_reward_payment_status(
    payload: dict,
    db: Session = Depends(get_db),
):
    reference = str(
        payload.get("tracking_reference", "")
    ).strip()

    tracking_secret = str(
        payload.get("tracking_secret", "")
    )

    if not reference or not tracking_secret:
        raise HTTPException(
            status_code=400,
            detail="Tracking reference and tracking secret are required",
        )

    report = (
        db.query(Report)
        .filter(Report.tracking_reference == reference)
        .first()
    )

    if not report or not hmac.compare_digest(
        report.tracking_secret_hash,
        hash_secret(tracking_secret),
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid tracking credentials",
        )

    reward = (
        db.query(ReportReward)
        .filter(ReportReward.report_id == report.id)
        .first()
    )

    if not reward:
        return {
            "reward_issued": False,
            "report_status": report.status.value,
            "message": "No reward has been issued for this report.",
        }

    messages = {
        "issued": "Your reward code is ready to redeem.",
        "processing": "Your payout is being processed.",
        "pending": "Your payout is awaiting approval.",
        "queued": "Your payout is queued.",
        "paid": "Your reward has been successfully paid.",
        "failed": "Your payout failed. Please contact the administrator.",
        "reversed": "Your payout was reversed. Please contact the administrator.",
    }

    return {
        "reward_issued": True,
        "amount": reward.amount_paise / 100,
        "currency": "INR",
        "status": reward.status,
        "upi_id": reward.upi_id_masked,
        "utr": reward.utr,
        "issued_at": reward.issued_at,
        "redeemed_at": reward.redeemed_at,
        "message": messages.get(
            reward.status,
            "Please check your reward status again.",
        ),
    }
