
'''
import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Enum as SQLAlchemyEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database import Base


def current_time():
    return datetime.now(timezone.utc)



# ENUMS

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OFFICER = "officer"


class ReportCategory(str, enum.Enum):
    DRUG_CONSUMER = "drug_consumer"
    DRUG_SELLER = "drug_seller"
    DRUG_PRODUCER = "drug_producer"
    MISCELLANEOUS = "miscellaneous"


class ReportStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    INVESTIGATION_IN_PROGRESS = "investigation_in_progress"
    INVESTIGATION_SUBMITTED = "investigation_submitted"
    ADMIN_VERIFICATION = "admin_verification"
    ACTION_COMPLETED = "action_completed"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"


class ReportPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# USER TABLE

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    username: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False, index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(UserRole), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="officer",
        foreign_keys="ReportAssignment.officer_id"
    )


# ANONYMOUS REPORT TABLE

class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    tracking_reference: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )

    # Store only a hash of the citizen's tracking secret.
    tracking_secret_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    category: Mapped[ReportCategory] = mapped_column(
        SQLAlchemyEnum(ReportCategory), nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    location_text: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    latitude: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    longitude: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    observed_frequency: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    observed_quantity: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )

    incident_datetime: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    status: Mapped[ReportStatus] = mapped_column(
        SQLAlchemyEnum(ReportStatus),
        default=ReportStatus.SUBMITTED,
        nullable=False
    )

    priority: Mapped[ReportPriority] = mapped_column(
        SQLAlchemyEnum(ReportPriority),
        default=ReportPriority.MEDIUM,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan"
    )

    investigations: Mapped[list["Investigation"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan"
    )


# -------------------------
# REPORT ASSIGNMENT TABLE
# -------------------------

class ReportAssignment(Base):
    __tablename__ = "report_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    assigned_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    report: Mapped["Report"] = relationship(
        back_populates="assignments"
    )

    officer: Mapped["User"] = relationship(
        back_populates="assignments",
        foreign_keys=[officer_id]
    )



# INVESTIGATION TABLE

class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    findings: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    verification_result: Mapped[str] = mapped_column(
        String(30), nullable=False
    )

    action_taken: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    report: Mapped["Report"] = relationship(
        back_populates="investigations"
    )
'''

'''
import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Enum as SQLAlchemyEnum,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database import Base


def current_time():
    return datetime.now(timezone.utc)


# ENUMS

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OFFICER = "officer"


class ReportCategory(str, enum.Enum):
    DRUG_CONSUMER = "drug_consumer"
    DRUG_SELLER = "drug_seller"
    DRUG_PRODUCER = "drug_producer"
    MISCELLANEOUS = "miscellaneous"


class ReportStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    INVESTIGATION_IN_PROGRESS = "investigation_in_progress"
    INVESTIGATION_SUBMITTED = "investigation_submitted"
    ADMIN_VERIFICATION = "admin_verification"
    ACTION_COMPLETED = "action_completed"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"


class ReportPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# USER TABLE

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    username: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False, index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(UserRole), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="officer",
        foreign_keys="ReportAssignment.officer_id"
    )


# ANONYMOUS REPORT TABLE

class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    tracking_reference: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )

    # Only a hash of the citizen's tracking secret is stored.
    tracking_secret_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    category: Mapped[ReportCategory] = mapped_column(
        SQLAlchemyEnum(ReportCategory), nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    location_text: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    latitude: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    longitude: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    observed_frequency: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    observed_quantity: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )

    incident_datetime: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    status: Mapped[ReportStatus] = mapped_column(
        SQLAlchemyEnum(ReportStatus),
        default=ReportStatus.SUBMITTED,
        nullable=False
    )

    priority: Mapped[ReportPriority] = mapped_column(
        SQLAlchemyEnum(ReportPriority),
        default=ReportPriority.MEDIUM,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan"
    )

    investigations: Mapped[list["Investigation"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan"
    )


# REPORT ASSIGNMENT TABLE

class ReportAssignment(Base):
    __tablename__ = "report_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    assigned_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    report: Mapped["Report"] = relationship(
        back_populates="assignments"
    )

    officer: Mapped["User"] = relationship(
        back_populates="assignments",
        foreign_keys=[officer_id]
    )


# INVESTIGATION TABLE

class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"), nullable=False, index=True
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    findings: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    verification_result: Mapped[str] = mapped_column(
        String(30), nullable=False
    )

    action_taken: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Stores metadata for uploaded investigation evidence.
    # Actual files are stored separately.
    evidence_files: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=current_time
    )

    report: Mapped["Report"] = relationship(
        back_populates="investigations"
    )
'''



import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Enum as SQLAlchemyEnum,
    JSON,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database import Base


def current_time():
    return datetime.now(timezone.utc)


# ENUMS

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OFFICER = "officer"


class ReportCategory(str, enum.Enum):
    DRUG_CONSUMER = "drug_consumer"
    DRUG_SELLER = "drug_seller"
    DRUG_PRODUCER = "drug_producer"
    MISCELLANEOUS = "miscellaneous"


class ReportStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ASSIGNED = "assigned"
    INVESTIGATION_IN_PROGRESS = "investigation_in_progress"
    INVESTIGATION_SUBMITTED = "investigation_submitted"
    ADMIN_VERIFICATION = "admin_verification"
    ACTION_COMPLETED = "action_completed"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"


class ReportPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# USER TABLE

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    full_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    username: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(UserRole),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="officer",
        foreign_keys="ReportAssignment.officer_id",
    )


# ANONYMOUS REPORT TABLE

class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    tracking_reference: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )

    # Only a hash of the citizen's tracking secret is stored.
    tracking_secret_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    category: Mapped[ReportCategory] = mapped_column(
        SQLAlchemyEnum(ReportCategory),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    location_text: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # Citizen-reported incident coordinates.
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    observed_frequency: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    observed_quantity: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    incident_datetime: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status: Mapped[ReportStatus] = mapped_column(
        SQLAlchemyEnum(ReportStatus),
        default=ReportStatus.SUBMITTED,
        nullable=False,
    )

    priority: Mapped[ReportPriority] = mapped_column(
        SQLAlchemyEnum(ReportPriority),
        default=ReportPriority.MEDIUM,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
    )

    assignments: Mapped[list["ReportAssignment"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
    )

    investigations: Mapped[list["Investigation"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
    )


# REPORT ASSIGNMENT TABLE

class ReportAssignment(Base):
    __tablename__ = "report_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"),
        nullable=False,
        index=True,
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    assigned_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
    )

    report: Mapped["Report"] = relationship(
        back_populates="assignments",
    )

    officer: Mapped["User"] = relationship(
        back_populates="assignments",
        foreign_keys=[officer_id],
    )


# INVESTIGATION TABLE

class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id"),
        nullable=False,
        index=True,
    )

    officer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    findings: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    verification_result: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    action_taken: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Metadata for uploaded investigation evidence.
    evidence_files: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    # Officer's investigation visit coordinates.
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
    )

    report: Mapped["Report"] = relationship(
        back_populates="investigations",
    )


# REWARD SETTINGS TABLE
class RewardSetting(Base):
    __tablename__ = "reward_settings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
    )

    amount_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
    )


# REWARD ISSUED FOR A COMPLETED REPORT
class ReportReward(Base):
    __tablename__ = "report_rewards"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Reward amount is stored in paise.
    amount_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Store only the SHA-256 hash of the reward code.
    code_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )

    # issued, processing, queued, paid, failed
    status: Mapped[str] = mapped_column(
        String(30),
        default="issued",
        nullable=False,
    )

    provider_payout_id: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )

    provider_reference: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )

    upi_id_masked: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    utr: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
    )

    redeemed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=current_time,
        onupdate=current_time,
    )

