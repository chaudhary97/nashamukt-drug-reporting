
import secrets
import string
import hashlib

from app.auth import password_hash


def generate_tracking_reference() -> str:
    random_part = secrets.token_hex(8).upper()
    return f"NM-{random_part}"


def generate_tracking_secret() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(32))


def hash_tracking_secret(secret: str) -> str:
    return password_hash.hash(secret)


def verify_tracking_secret(secret: str, hashed_secret: str) -> bool:
    return password_hash.verify(secret, hashed_secret)
