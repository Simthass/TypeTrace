# backend/app/schemas/user.py

import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


UserRole = Literal["STUDENT", "TEACHER"]


# =============================================================================
# SHARED VALIDATORS
# =============================================================================

def _clean_text(value: str) -> str:
    clean = re.sub(r"<[^>]*>", "", value or "")
    clean = clean.strip()
    if not clean:
        raise ValueError("This field cannot be empty.")
    return clean


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must contain at least one number.")
    if not any(not char.isalnum() for char in value):
        raise ValueError("Password must contain at least one special character.")
    return value


# =============================================================================
# REGISTRATION SCHEMAS
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
    def sanitize_name(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) < 5:
            raise ValueError("Student ID must be numeric and at least 5 digits.")
        return clean

    @field_validator("university_name")
    @classmethod
    def sanitize_optional_university(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        clean = re.sub(r"<[^>]*>", "", value).strip()
        return clean or None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Biometric data processing consent is required.")
        return value


class TeacherRegister(BaseModel):
    role: Literal["TEACHER"] = "TEACHER"
    first_name: str
    last_name: str
    email: EmailStr
    university_name: str
    department: str
    password: str
    consent: bool

    @field_validator("first_name", "last_name", "university_name", "department")
    @classmethod
    def sanitize_required_text(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Data processing agreement must be accepted.")
        return value


# =============================================================================
# AUTH REQUEST SCHEMAS
# =============================================================================

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise ValueError("OTP must be exactly 6 digits.")
        return clean


class ResendOTPRequest(BaseModel):
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise ValueError("OTP must be exactly 6 digits.")
        return clean


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    role: UserRole
    student_id: Optional[str] = None
    university_name: Optional[str] = None
    department: Optional[str] = None
    is_verified: bool

    class Config:
        from_attributes = True


class AuthTokenResponse(BaseModel):
    message: str
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    role: UserRole


class MessageResponse(BaseModel):
    message: str


class PasswordResetVerifyResponse(BaseModel):
    message: str
    reset_token: str


class TokenVerifyResponse(BaseModel):
    valid: bool
    user: UserResponse