
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Report, ReportStatus, ReportCategory as ModelReportCategory
from app.schemas import ReportCreate
from app.utils import (
    generate_tracking_reference,
    generate_tracking_secret,
    hash_tracking_secret,
    verify_tracking_secret,
)


def create_report(data: ReportCreate, db: Session):
    tracking_reference = generate_tracking_reference()
    tracking_secret = generate_tracking_secret()

    report = Report(
        tracking_reference=tracking_reference,
        tracking_secret_hash=hash_tracking_secret(tracking_secret),
        category=ModelReportCategory(data.category.value),
        description=data.description,
        location_text=data.location_text,
        latitude=data.latitude,
        longitude=data.longitude,
        observed_frequency=data.observed_frequency,
        observed_quantity=data.observed_quantity,
        incident_datetime=data.incident_datetime,
        status=ReportStatus.SUBMITTED,
    )

    try:
        db.add(report)
        db.commit()
        db.refresh(report)
    except Exception:
        db.rollback()
        raise HTTPException(500, "Unable to submit report")

    return {
        "message": "Report submitted successfully",
        "tracking_reference": tracking_reference,
        "tracking_secret": tracking_secret,
        "status": report.status.value,
    }


def track_report(tracking_reference, tracking_secret, db):
    report = (
        db.query(Report)
        .filter(Report.tracking_reference == tracking_reference)
        .first()
    )

    if report is None:
        raise HTTPException(404, "Invalid tracking credentials")

    if not verify_tracking_secret(
        tracking_secret,
        report.tracking_secret_hash
    ):
        raise HTTPException(404, "Invalid tracking credentials")

    return {
        "tracking_reference": report.tracking_reference,
        "status": report.status.value,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }
