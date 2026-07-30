from __future__ import annotations

import re
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

UserRole = Literal["STUDENT", "TEACHER"]
RegistrationState = Literal["PENDING", "CLAIMED", "LOCKED", "COMPLETED"]
PasswordResetState = Literal[
    "OTP_PENDING",
    "TOKEN_ISSUED",
    "CLAIMED",
    "LOCKED",
    "COMPLETED",
]

_REGISTRATION_ID_PATTERN = re.compile(r"^reg_[A-Za-z0-9_-]{32,160}$")
_RESET_ID_PATTERN = re.compile(r"^rst_[A-Za-z0-9_-]{32,160}$")


def _clean_text(value: str) -> str:
    clean = re.sub(r"<[^>]*>", "", value or "").strip()
    if not clean:
        raise ValueError("This field cannot be empty.")
    return clean


def _validate_password_strength(value: str) -> str:
    if len(value) < 8 or len(value) > 128:
        raise ValueError("Password must be between 8 and 128 characters.")
    if not any(char.isalpha() for char in value):
        raise ValueError("Password must contain at least one letter.")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must contain at least one number.")
    return value


def _validate_registration_id(value: str) -> str:
    clean = value.strip()
    if not _REGISTRATION_ID_PATTERN.fullmatch(clean):
        raise ValueError("Invalid registration session identifier.")
    return clean


def _validate_reset_id(value: str) -> str:
    clean = value.strip()
    if not _RESET_ID_PATTERN.fullmatch(clean):
        raise ValueError("Invalid password-reset session identifier.")
    return clean


def _validate_otp(value: str) -> str:
    clean = value.strip()
    if not clean.isdigit() or len(clean) != 6:
        raise ValueError("OTP must be exactly 6 digits.")
    return clean


class StudentRegister(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    role: Literal["STUDENT"] = "STUDENT"
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    student_id: str = Field(min_length=5, max_length=30)
    email: EmailStr
    university_name: Optional[str] = Field(default=None, max_length=200)
    password: str
    consent: bool

    @field_validator("first_name", "last_name")
    @classmethod
    def sanitize_name(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("university_name")
    @classmethod
    def sanitize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        clean = value.strip()
        return _clean_text(clean) if clean else None

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, value: str) -> str:
        clean = value.strip()
        if not clean.isdigit() or len(clean) < 5:
            raise ValueError("Student ID must be numeric and at least 5 digits.")
        return clean

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
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    role: Literal["TEACHER"] = "TEACHER"
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: EmailStr
    university_name: str = Field(min_length=1, max_length=200)
    department: str = Field(min_length=1, max_length=200)
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


RegistrationRequest = Annotated[
    Union[StudentRegister, TeacherRegister],
    Field(discriminator="role"),
]


class OTPVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registration_id: str
    otp: str

    _registration_id = field_validator("registration_id")(_validate_registration_id)
    _otp = field_validator("otp")(_validate_otp)


class ResendOTPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registration_id: str

    _registration_id = field_validator("registration_id")(_validate_registration_id)


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PasswordResetVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reset_id: str
    otp: str

    _reset_id = field_validator("reset_id")(_validate_reset_id)
    _otp = field_validator("otp")(_validate_otp)


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reset_token: str = Field(min_length=40, max_length=4096)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: Optional[str] = None
    email: EmailStr
    role: UserRole
    student_id: Optional[str] = None
    university_name: Optional[str] = None
    department: Optional[str] = None
    is_verified: bool


class AuthTokenResponse(BaseModel):
    message: str
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse
    already_completed: bool = False


class RegisterResponse(BaseModel):
    message: str
    registration_id: str
    email: EmailStr
    role: UserRole
    expires_in_seconds: int = Field(gt=0)


class RegistrationStatusResponse(BaseModel):
    registration_id: str
    email: EmailStr
    role: UserRole
    state: RegistrationState
    expires_in_seconds: int = Field(ge=0)
    attempts_remaining: int = Field(ge=0)
    resends_remaining: int = Field(ge=0)
    resend_available_in_seconds: int = Field(ge=0)


class MessageResponse(BaseModel):
    message: str


class PasswordResetRequestResponse(BaseModel):
    message: str
    reset_id: str
    expires_in_seconds: int = Field(gt=0)


class PasswordResetVerifyResponse(BaseModel):
    message: str
    reset_token: str


class PasswordResetStatusResponse(BaseModel):
    reset_id: str
    email: EmailStr
    state: PasswordResetState
    expires_in_seconds: int = Field(ge=0)
    attempts_remaining: int = Field(ge=0)


class TokenVerifyResponse(BaseModel):
    valid: bool
    user: UserResponse
