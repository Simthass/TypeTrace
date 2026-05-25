# backend/app/schemas/user.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Literal
import re

# =============================================================================
# REGISTRATION SCHEMAS
# Two distinct payloads — one for students, one for teachers.
# The frontend sends `role` at the top level so the backend knows which
# validator to apply. We use a Union in the endpoint.
# =============================================================================

class StudentRegister(BaseModel):
    role: Literal["STUDENT"] = "STUDENT"
    first_name: str
    last_name: str
    student_id: str
    email: EmailStr
    university_name: Optional[str] = None
    password: str
    consent: bool

    @field_validator("first_name", "last_name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        clean = re.sub(r"<[^>]*>", "", v)
        if not clean.strip():
            raise ValueError("Name cannot be empty or just symbols")
        return clean.strip()

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, v: str) -> str:
        if not v.isdigit() or len(v) < 5:
            raise ValueError("Student ID must be numeric and at least 5 digits")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Biometric consent is legally required")
        return v


class TeacherRegister(BaseModel):
    role: Literal["TEACHER"] = "TEACHER"
    first_name: str
    last_name: str
    email: EmailStr
    university_name: str
    department: str
    password: str
    # Teachers consent to processing student data, not biometric capture of themselves
    consent: bool

    @field_validator("first_name", "last_name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        clean = re.sub(r"<[^>]*>", "", v)
        if not clean.strip():
            raise ValueError("Name cannot be empty or just symbols")
        return clean.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the data processing agreement")
        return v


# =============================================================================
# AUTH SCHEMAS (unchanged)
# =============================================================================

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    student_id: Optional[str]
    email: EmailStr
    role: str
    is_verified: bool

    class Config:
        from_attributes = True


# =============================================================================
# PASSWORD RESET SCHEMAS (unchanged from original)
# =============================================================================

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one special character")
        return v