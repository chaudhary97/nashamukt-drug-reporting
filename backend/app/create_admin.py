
from getpass import getpass

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, UserRole
from app.auth import hash_password


def create_admin():
    db: Session = SessionLocal()

    try:
        username = input("Enter admin username: ").strip()
        full_name = input("Enter admin full name: ").strip()
        password = getpass("Enter admin password: ")
        confirm_password = getpass("Confirm admin password: ")

        if not username or not full_name:
            print("Username and name are required.")
            return

        if len(password) < 12:
            print("Password must contain at least 12 characters.")
            return

        if password != confirm_password:
            print("Passwords do not match.")
            return

        existing_user = db.query(User).filter(
            User.username == username
        ).first()

        if existing_user:
            print("Username already exists.")
            return

        admin = User(
            full_name=full_name,
            username=username,
            password_hash=hash_password(password),
            role=UserRole.ADMIN
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
