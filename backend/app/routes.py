
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User,
    UserRole,
    Report,
    ReportStatus,
    ReportAssignment,
    ReportPriority,
    Investigation,
)
from app.schemas import (
    ReportCreate,
    ReportTrackRequest,
    LoginRequest,
    LoginResponse,
    ReportAssignmentCreate,
    InvestigationCreate,
    AdminInvestigationReview,
)
from app.report_service import create_report, track_report
from app.admin_service import (
    review_investigation,
    complete_report_action,
)
from app.auth import (
    verify_password,
    create_access_token,
    require_admin,
    require_officer,
)

router = APIRouter()


# Citizen report submission

@router.post("/reports")
def submit_report(
    data: ReportCreate,
    db: Session = Depends(get_db)
):
    return create_report(data, db)


# Citizen report tracking

@router.post("/reports/track")
def track_citizen_report(
    data: ReportTrackRequest,
    db: Session = Depends(get_db)
):
    return track_report(
        data.tracking_reference,
        data.tracking_secret,
        db
    )


# Admin and officer login

@router.post("/auth/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.username == data.username
    ).first()

    if not user or not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is inactive"
        )

    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role.value
    }


# Admin report management

@router.get("/admin/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    reports = db.query(Report).order_by(
        Report.created_at.desc()
    ).all()

    return [
        {
            "id": str(report.id),
            "tracking_reference": report.tracking_reference,
            "category": report.category.value,
            "description": report.description,
            "location_text": report.location_text,
            "status": report.status.value,
            "priority": report.priority.value,
            "created_at": report.created_at,
        }
        for report in reports
    ]


# Admin officer list

@router.get("/admin/officers")
def get_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    officers = db.query(User).filter(
        User.role == UserRole.OFFICER,
        User.is_active.is_(True)
    ).all()

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
    data: ReportAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    report = db.query(Report).filter(
        Report.id == report_id
    ).first()

    if not report:
        raise HTTPException(404, "Report not found")

    if report.status not in (
        ReportStatus.SUBMITTED,
        ReportStatus.UNDER_REVIEW
    ):
        raise HTTPException(
            400,
            "Report cannot be assigned in its current status"
        )

    officer = db.query(User).filter(
        User.id == data.officer_id,
        User.role == UserRole.OFFICER,
        User.is_active.is_(True)
    ).first()

    if not officer:
        raise HTTPException(404, "Active officer not found")

    assignment = ReportAssignment(
        report_id=report.id,
        officer_id=officer.id,
        assigned_by=current_user.id,
        deadline=data.deadline,
    )

    report.status = ReportStatus.ASSIGNED
    report.priority = ReportPriority(data.priority.value)

    try:
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
    except Exception:
        db.rollback()
        raise HTTPException(
            500,
            "Unable to assign report"
        )

    return {
        "message": "Report assigned successfully",
        "assignment_id": str(assignment.id),
        "officer_id": str(officer.id),
        "status": report.status.value,
    }


# Officer views assigned reports

@router.get("/officer/assignments")
def get_officer_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer)
):
    assignments = db.query(ReportAssignment).filter(
        ReportAssignment.officer_id == current_user.id
    ).all()

    return [
        {
            "assignment_id": str(assignment.id),
            "report_id": str(assignment.report.id),
            "category": assignment.report.category.value,
            "description": assignment.report.description,
            "location_text": assignment.report.location_text,
            "priority": assignment.report.priority.value,
            "status": assignment.report.status.value,
            "deadline": assignment.deadline,
        }
        for assignment in assignments
    ]


# Officer submits investigation

@router.post("/officer/reports/{report_id}/investigation")
def submit_investigation(
    report_id: str,
    data: InvestigationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_officer)
):
    assignment = db.query(ReportAssignment).filter(
        ReportAssignment.report_id == report_id,
        ReportAssignment.officer_id == current_user.id
    ).first()

    if not assignment:
        raise HTTPException(
            403,
            "This report is not assigned to you"
        )

    report = assignment.report

    if report.status not in (
        ReportStatus.ASSIGNED,
        ReportStatus.INVESTIGATION_IN_PROGRESS
    ):
        raise HTTPException(
            400,
            "Investigation cannot be submitted in current status"
        )

    investigation = Investigation(
        report_id=report.id,
        officer_id=current_user.id,
        findings=data.findings,
        verification_result=data.verification_result.value,
        action_taken=data.action_taken,
        submitted_at=datetime.now(timezone.utc),
    )

    report.status = ReportStatus.INVESTIGATION_SUBMITTED

    try:
        db.add(investigation)
        db.commit()
        db.refresh(investigation)
    except Exception:
        db.rollback()
        raise HTTPException(
            500,
            "Unable to submit investigation"
        )

    return {
        "message": "Investigation submitted for admin review",
        "investigation_id": str(investigation.id),
        "status": report.status.value,
    }


# Admin reviews investigation

@router.post("/admin/reports/{report_id}/review")
def admin_review_investigation(
    report_id: str,
    data: AdminInvestigationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return review_investigation(
        report_id,
        data.decision.value,
        db
    )


# Admin completes verified action

@router.post("/admin/reports/{report_id}/complete")
def admin_complete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return complete_report_action(
        report_id,
        db
    )
