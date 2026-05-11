from pydantic import BaseModel, EmailStr, field_validator
import re

# ─── INCOMING REQUEST SCHEMAS ─────────────────────────────────────────────────

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    student_id: str
    email: EmailStr # Pydantic automatically checks if this is a real email format
    password: str
    consent: bool

    # i found this regex on stackoverflow to remove html tags so we dont get XSS attacks
    @field_validator('first_name', 'last_name')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        clean_text = re.sub(r'<[^>]*>', '', v)
        if not clean_text.strip():
            raise ValueError("Name cannot be empty or just symbols")
        return clean_text.strip()

    @field_validator('student_id')
    @classmethod
    def validate_student_id(cls, v: str) -> str:
        # making sure student id is only numbers so sql injection fails here
        if not v.isdigit() or len(v) < 5:
            raise ValueError("Student ID must be numeric and at least 5 digits long")
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        # professor said passwords must be strong. min 8 chars, 1 number, 1 special char
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one number")
        if not any(not char.isalnum() for char in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator('consent')
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Biometric consent is legally required")
        return v


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator('otp')
    @classmethod
    def validate_otp(cls, v: str) -> str:
        # strictly 6 digits, if hacker sends a huge string it fails instantly
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ─── OUTGOING RESPONSE SCHEMAS ────────────────────────────────────────────────
# We never send the password hash back to the frontend!

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    student_id: str
    email: EmailStr
    is_verified: bool

    # this tells pydantic to read from SQLAlchemy database models automatically
    class Config:
        from_attributes = True
        


class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator('otp')
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        # reusing the same strong password logic from registration
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one number")
        if not any(not char.isalnum() for char in v):
            raise ValueError("Password must contain at least one special character")
        return v