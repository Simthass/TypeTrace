from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


from app.api.deps import get_current_user
from app.core.config import settings
from app.core.jwt import create_access_token, create_reset_token, verify_reset_token
from app.core.rate_limit import limiter, per_minute
from app.core.security import (
    generate_otp,
    get_password_hash,
    secure_compare,
    verify_password,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    AuthTokenResponse,
    MessageResponse,
    OTPVerify,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetVerify,
    PasswordResetVerifyResponse,
    RegisterResponse,
    ResendOTPRequest,
    StudentRegister,
    TeacherRegister,
    TokenVerifyResponse,
    UserLogin,
    UserResponse,
)
from app.services import redis_cache


router = APIRouter()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role,
        student_id=user.student_id,
        university_name=user.university_name,
        department=user.department,
        is_verified=bool(user.is_verified),
    )


async def _send_otp_email(email: str, otp: str) -> None:
    from app.services import email as email_service

    await email_service.send_otp_email(email=email, otp=otp)


# =============================================================================
# REGISTER
# =============================================================================

@router.post(
    "/register",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RegisterResponse,
)
@limiter.limit(per_minute(settings.MAX_LOGIN_ATTEMPTS_PER_MINUTE))
async def register_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Starts registration by validating role-specific payload,
    storing pending user data in Redis, and sending an OTP.
    """

    body = await request.json()
    role = str(body.get("role", "STUDENT")).upper()

    if role not in {"STUDENT", "TEACHER"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be STUDENT or TEACHER.",
        )

    try:
        user_in: Union[StudentRegister, TeacherRegister]
        if role == "TEACHER":
            user_in = TeacherRegister(**body)
        else:
            user_in = StudentRegister(**body)

    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        )

    email = _normalize_email(str(user_in.email))

    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )

    if role == "STUDENT" and isinstance(user_in, StudentRegister):
        existing_student_id = await db.execute(
            select(User).where(User.student_id == user_in.student_id)
        )
        if existing_student_id.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID already registered.",
            )

    hashed_password = get_password_hash(user_in.password)
    otp = generate_otp()

    success = await redis_cache.store_pending_user(
        user_data=user_in,
        otp=otp,
        hashed_password=hashed_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process registration. Please try again.",
        )

    await _send_otp_email(email=email, otp=otp)

    return RegisterResponse(
        message="OTP sent to your email. Please verify to complete registration.",
        email=email,
        role=role,
    )


# =============================================================================
# RESEND OTP
# =============================================================================

@router.post(
    "/resend-otp",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def resend_registration_otp(
    request: Request,
    req: ResendOTPRequest,
):
    """
    Resends OTP for an existing pending registration.
    """

    email = _normalize_email(str(req.email))
    pending_user = await redis_cache.get_pending_user(email)

    if not pending_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session expired or invalid. Please register again.",
        )

    otp = generate_otp()
    updated = await redis_cache.update_pending_user_otp(email=email, otp=otp)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend OTP. Please try again.",
        )

    await _send_otp_email(email=email, otp=otp)

    return MessageResponse(message="A new OTP has been sent to your email.")


# =============================================================================
# VERIFY OTP
# =============================================================================

@router.post(
    "/verify-otp",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthTokenResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def verify_otp(
    request: Request,
    otp_in: OTPVerify,
    db: AsyncSession = Depends(get_db),
):
    """
    Completes registration by verifying OTP and creating the user.
    """

    email = _normalize_email(str(otp_in.email))
    pending_user = await redis_cache.get_pending_user(email)

    if not pending_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session expired or invalid. Please register again.",
        )

    if not secure_compare(str(pending_user.get("otp") or ""), str(otp_in.otp)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code.",
        )

    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalars().first():
        await redis_cache.delete_pending_user(email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )

    student_id = pending_user.get("student_id")

    if student_id:
        existing_student_id = await db.execute(
            select(User).where(User.student_id == student_id)
        )
        if existing_student_id.scalars().first():
            await redis_cache.delete_pending_user(email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student ID already registered.",
            )

    new_user = User(
        first_name=pending_user["first_name"],
        last_name=pending_user.get("last_name") or "",
        email=email,
        hashed_password=pending_user["hashed_password"],
        role=pending_user.get("role", "STUDENT"),
        student_id=student_id,
        university_name=pending_user.get("university_name"),
        department=pending_user.get("department"),
        is_verified=True,
    )

    try:
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email or Student ID already exists.",
        )

    await redis_cache.delete_pending_user(email)

    access_token = create_access_token(
        data={
            "sub": new_user.email,
            "id": str(new_user.id),
            "role": new_user.role,
        }
    )

    return AuthTokenResponse(
        message="Account verified successfully.",
        access_token=access_token,
        user=_serialize_user(new_user),
    )


# =============================================================================
# LOGIN
# =============================================================================

@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=AuthTokenResponse,
)
@limiter.limit(per_minute(settings.MAX_LOGIN_ATTEMPTS_PER_MINUTE))
async def login_user(
    request: Request,
    login_in: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates a verified user and returns a JWT.
    """

    email = _normalize_email(str(login_in.email))

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified.",
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "id": str(user.id),
            "role": user.role,
        }
    )

    return AuthTokenResponse(
        message="Login successful.",
        access_token=access_token,
        user=_serialize_user(user),
    )


# =============================================================================
# CURRENT USER / TOKEN VERIFICATION
# =============================================================================

@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    response_model=UserResponse,
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the authenticated user profile.
    """

    return _serialize_user(current_user)


@router.get(
    "/verify-token",
    status_code=status.HTTP_200_OK,
    response_model=TokenVerifyResponse,
)
async def verify_token(
    current_user: User = Depends(get_current_user),
):
    """
    Allows frontend to confirm that the persisted JWT is still valid.
    """

    return TokenVerifyResponse(
        valid=True,
        user=_serialize_user(current_user),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
async def logout_user():
    """
    Stateless JWT logout endpoint.

    The frontend clears the token. Backend confirms the action.
    """

    return MessageResponse(message="Logged out successfully.")


# =============================================================================
# PASSWORD RESET
# =============================================================================

@router.post(
    "/password-reset/request",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def request_password_reset(
    request: Request,
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Sends password reset OTP if the account exists.

    Always returns 200 to prevent email enumeration.
    """

    email = _normalize_email(str(req.email))

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if user:
        otp = generate_otp()
        stored = await redis_cache.store_reset_otp(email=email, otp=otp)

        if stored:
            await _send_otp_email(email=email, otp=otp)

    return MessageResponse(
        message="If that email exists, a reset code has been sent.",
    )


@router.post(
    "/password-reset/verify",
    status_code=status.HTTP_200_OK,
    response_model=PasswordResetVerifyResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def verify_password_reset(
    request: Request,
    req: PasswordResetVerify,
):
    """
    Verifies reset OTP and returns a short-lived reset token.
    """

    email = _normalize_email(str(req.email))

    saved_otp = await redis_cache.get_reset_otp(email)

    if not saved_otp or not secure_compare(str(saved_otp), str(req.otp)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code.",
        )

    reset_token = create_reset_token(email)
    await redis_cache.delete_reset_otp(email)

    return PasswordResetVerifyResponse(
        reset_token=reset_token,
        message="Code verified.",
    )


@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_200_OK,
    response_model=MessageResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def confirm_password_reset(
    request: Request,
    req: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    """
    Updates password after reset token verification.
    """

    email = _normalize_email(str(req.email))

    if not verify_reset_token(req.reset_token, email):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session.",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.hashed_password = get_password_hash(req.new_password)

    db.add(user)
    await db.commit()

    return MessageResponse(message="Password updated successfully.")
