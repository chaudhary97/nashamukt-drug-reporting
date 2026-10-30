
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Report, ReportStatus, Investigation


def review_investigation(
    report_id: str,
    decision: str,
    db: Session
):
    report = db.query(Report).filter(
        Report.id == report_id
    ).first()

    if not report:
        raise HTTPException(404, "Report not found")

    if report.status != ReportStatus.INVESTIGATION_SUBMITTED:
        raise HTTPException(
            400,
            "Report is not waiting for investigation review"
        )

    investigation = db.query(Investigation).filter(
        Investigation.report_id == report.id
    ).order_by(
        Investigation.submitted_at.desc()
    ).first()

    if not investigation:
        raise HTTPException(404, "Investigation not found")

    decision = decision.strip().lower()

    if decision == "verified":
        report.status = ReportStatus.ADMIN_VERIFICATION

    elif decision == "false":
        report.status = ReportStatus.REJECTED

    elif decision == "inconclusive":
        report.status = ReportStatus.INCONCLUSIVE

    else:
        raise HTTPException(
            400,
            "Decision must be verified, false, or inconclusive"
        )

    try:
        db.commit()
        db.refresh(report)
    except Exception:
        db.rollback()
        raise HTTPException(500, "Unable to review investigation")

    return {
        "message": "Investigation reviewed successfully",
        "report_id": str(report.id),
        "admin_decision": decision,
        "status": report.status.value
    }


def complete_report_action(
    report_id: str,
    db: Session
):
    report = db.query(Report).filter(
        Report.id == report_id
    ).first()

    if not report:
        raise HTTPException(404, "Report not found")

    if report.status != ReportStatus.ADMIN_VERIFICATION:
        raise HTTPException(
            400,
            "Only admin-verified reports can be marked action completed"
        )

    report.status = ReportStatus.ACTION_COMPLETED

    try:
        db.commit()
        db.refresh(report)
    except Exception:
        db.rollback()
        raise HTTPException(500, "Unable to complete report action")

    return {
        "message": "Action marked as completed",
        "report_id": str(report.id),
        "status": report.status.value,
        "reward_eligible": True
    }
