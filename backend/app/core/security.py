# backend/app/core/security.py
import bcrypt
import secrets
import string


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored bcrypt hash."""
    # bcrypt requires bytes, not strings. so we encode them first.
    password_bytes = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(password=password_bytes, hashed_password=hashed_password_bytes)

def get_password_hash(password: str) -> str:
    """Hashes the password using bcrypt natively."""
    # encoding to utf-8 cos bcrypt needs bytes
    pwd_bytes = password.encode('utf-8')
    
    # generating a cryptographically secure salt
    salt = bcrypt.gensalt()
    
    # hashing the password with the salt
    hashed_password_bytes = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    
    # returning as a string so it can be saved in our PostgreSQL database easily
    return hashed_password_bytes.decode('utf-8')

def generate_otp() -> str:
    """
    Generates a cryptographically secure 6-digit OTP.
    Using secrets module instead of random cos random is predictable.
    """
    # i read online that standard random() can be guessed by hackers. 
    # secrets module is cryptographically safe.
    digits = string.digits
    otp = ''.join(secrets.choice(digits) for i in range(6))
    return otp