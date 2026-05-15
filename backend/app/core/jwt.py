# backend/app/core/jwt.py
from datetime import datetime, timedelta
from jose import jwt
import os

# i will put this in a secure .env file later.
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # token lasts for 24 hours

def create_access_token(data: dict) -> str:
    """
    Mints a secure JWT token for authenticated users.
    """
    to_encode = data.copy()
    
    # calculate exact expiration time
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # payload standard claims: 'sub' is the subject (user email), 'exp' is expiration
    to_encode.update({"exp": expire})
    
    # encode using the secret key and HS256 algorithm
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def create_reset_token(email: str) -> str:
    """
    Creates a temporary token that allows the user to set a new password.
    """
    expire = datetime.utcnow() + timedelta(minutes=15)
    # i added a "type" claim so hackers cant use a reset token to login to the app
    to_encode = {"sub": email, "exp": expire, "type": "password_reset"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_reset_token(token: str, email: str) -> bool:
    """
    Makes sure the reset token is valid, unexpired, and matches the email.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset" or payload.get("sub") != email:
            return False
        return True
    except:
        return False