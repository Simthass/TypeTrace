import logging
from datetime import datetime, timezone
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from jose import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.jwt import (
    create_access_token,
    create_reset_token,
    decode_reset_token,
)
from app.core.rate_limit import limiter, per_minute
from app.core.security import generate_otp, get_password_hash, verify_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    AuthTokenResponse,
    MessageResponse,
    OTPVerify,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    PasswordResetStatusResponse,
    PasswordResetVerify,
    PasswordResetVerifyResponse,
    RegisterResponse,
    RegistrationRequest,
    RegistrationStatusResponse,
    ResendOTPRequest,
    TokenVerifyResponse,
    UserLogin,
    UserResponse,
)
from app.services import redis_cache
from app.services.audit_log import create_audit_log
from app.services.email import EmailDeliveryError, send_otp_email

logger = logging.getLogger("typetrace.auth")
router = APIRouter()

REGISTRATION_ID_PATH = Path(
    min_length=36,
    max_length=200,
    pattern=r"^reg_[A-Za-z0-9_-]{32,160}$",
)
RESET_ID_PATH = Path(
    min_length=36,
    max_length=200,
    pattern=r"^rst_[A-Za-z0-9_-]{32,160}$",
)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _frontend_recovery_url(path: str, key: str, value: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}{path}#{key}={quote(value, safe='')}"


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


def _access_token(user: User) -> str:
    return create_access_token(
        data={
            "sub": user.email,
            "id": str(user.id),
            "role": user.role,
            "token_version": int(user.token_version or 0),
        }
    )


def _auth_response(
    user: User,
    *,
    message: str,
    already_completed: bool = False,
) -> AuthTokenResponse:
    return AuthTokenResponse(
        message=message,
        access_token=_access_token(user),
        user=_serialize_user(user),
        already_completed=already_completed,
    )


def _parse_consent_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Missing consent timestamp.")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _required_pending_text(payload: dict[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing pending registration field: {key}.")
    return value.strip()


@router.post(
    "/register",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RegisterResponse,
)
@limiter.limit(per_minute(settings.MAX_LOGIN_ATTEMPTS_PER_MINUTE))
async def register_user(
    request: Request,
    response: Response,
    user_in: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    del response
    email = _normalize_email(str(user_in.email))

    existing_user = (
        await db.execute(select(User.id).where(User.email == email))
    ).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    student_id = getattr(user_in, "student_id", None)
    if student_id:
        existing_student = (
            await db.execute(select(User.id).where(User.student_id == student_id))
        ).scalar_one_or_none()
        if existing_student is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Student ID already registered.",
            )

    otp = generate_otp()
    try:
        pending = await redis_cache.create_pending_registration(
            user_data=user_in,
            otp=otp,
            hashed_password=get_password_hash(user_in.password),
        )
    except redis_cache.ActiveRegistrationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An active registration already exists for this email. "
                "Complete it or wait for it to expire."
            ),
        ) from exc
    except Exception as exc:
        logger.exception("Unable to create pending registration")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration service is temporarily unavailable.",
        ) from exc

    try:
        await send_otp_email(
            email=user_in.email,
            otp=otp,
            purpose="verification",
            action_url=_frontend_recovery_url(
                "/verify-otp",
                "registration_id",
                str(pending["registration_id"]),
            ),
        )
    except EmailDeliveryError as exc:
        try:
            cancelled = await redis_cache.cancel_pending_registration(
                pending["registration_id"]
            )
            if cancelled.get("status") not in {"CANCELLED", "MISSING"}:
                logger.error(
                    "Registration cleanup after email failure returned %s",
                    cancelled.get("status"),
                )
        except Exception:
            logger.exception(
                "Failed to remove registration after email delivery failure"
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Verification email could not be delivered. "
                "No account was created; please try again."
            ),
        ) from exc

    return RegisterResponse(
        message="Verification code sent.",
        registration_id=str(pending["registration_id"]),
        email=email,
        role=user_in.role,
        expires_in_seconds=redis_cache.REGISTRATION_TTL_SECONDS,
    )


@router.get(
    "/pending-registration/{registration_id}",
    response_model=RegistrationStatusResponse,
)
async def registration_status(
    registration_id: str = REGISTRATION_ID_PATH,
) -> RegistrationStatusResponse:
    try:
        result = await redis_cache.get_registration_status(registration_id)
    except Exception as exc:
        logger.exception("Unable to read registration status")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification service is temporarily unavailable.",
        ) from exc
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification session expired. Please register again.",
        )
    return RegistrationStatusResponse.model_validate(result)


@router.post("/resend-otp", response_model=MessageResponse)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def resend_registration_otp(
    request: Request,
    response: Response,
    req: ResendOTPRequest,
) -> MessageResponse:
    del request, response
    otp = generate_otp()
    try:
        prepared = await redis_cache.prepare_registration_resend(
            req.registration_id,
            otp,
        )
    except Exception as exc:
        logger.exception("Redis failure during registration resend")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification service is temporarily unavailable.",
        ) from exc

    state = prepared["status"]
    if state == "MISSING":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification session expired. Please register again.",
        )
    if state == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Verification session is locked. Please register again.",
        )
    if state == "COOLDOWN":
        retry_after = max(int(prepared.get("retry_after") or 1), 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Please wait {retry_after} seconds before requesting another code."
            ),
            headers={"Retry-After": str(retry_after)},
        )
    if state == "LIMIT":
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum resend limit reached. Please register again.",
        )
    if state != "READY":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Verification is already being processed.",
        )

    reservation_token = str(prepared["reservation_token"])
    try:
        await send_otp_email(
            email=prepared["email"],
            otp=otp,
            purpose="verification",
        )
    except EmailDeliveryError as exc:
        try:
            aborted = await redis_cache.abort_registration_resend(
                req.registration_id,
                reservation_token,
            )
            if not aborted:
                logger.error(
                    "Resend reservation could not be released after email failure"
                )
        except Exception:
            logger.exception("Failed to release resend reservation")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "New code could not be delivered. "
                "Your previous verification code remains valid."
            ),
        ) from exc

    try:
        committed = await redis_cache.commit_registration_resend(
            req.registration_id,
            reservation_token,
        )
    except Exception as exc:
        logger.exception("Redis failure after resend email delivery")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The new email was sent but could not be activated. "
                "Your previous code remains valid; retry later."
            ),
        ) from exc
    if not committed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Verification session changed while resending. "
                "Your previous code remains valid."
            ),
        )
    return MessageResponse(message="A new verification code has been sent.")


@router.delete(
    "/pending-registration/{registration_id}",
    response_model=MessageResponse,
)
async def cancel_pending_registration(
    registration_id: str = REGISTRATION_ID_PATH,
) -> MessageResponse:
    try:
        result = await redis_cache.cancel_pending_registration(registration_id)
    except Exception as exc:
        logger.exception("Pending registration cancellation failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not cancel registration now. "
                "The pending data will expire automatically."
            ),
        ) from exc

    state = result["status"]
    if state == "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration verification is already being processed.",
        )
    if state == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration has already completed. Sign in instead.",
        )
    return MessageResponse(
        message=(
            "Pending registration cancelled."
            if state == "CANCELLED"
            else "Pending registration was already absent."
        )
    )


@router.post(
    "/verify-otp",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthTokenResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def verify_otp(
    request: Request,
    response: Response,
    otp_in: OTPVerify,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    del response

    # PostgreSQL is authoritative. A completed registration must not allow the
    # original OTP to mint additional access tokens. A retry receives a stable,
    # controlled result and the user signs in with the password they created.
    committed_user = (
        await db.execute(
            select(User.id).where(User.registration_id == otp_in.registration_id)
        )
    ).scalar_one_or_none()
    if committed_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account is already verified. Sign in to continue.",
        )

    try:
        claim = await redis_cache.claim_registration(
            otp_in.registration_id,
            otp_in.otp,
        )
    except Exception as exc:
        logger.exception("Registration claim failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification service is temporarily unavailable.",
        ) from exc

    claim_status = claim["status"]
    if claim_status == "MISSING":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Verification session expired. Please register again.",
        )
    if claim_status == "INVALID":
        attempts = int(claim.get("attempts") or 0)
        remaining = max(redis_cache.MAX_OTP_ATTEMPTS - attempts, 0)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid verification code. {remaining} attempts remaining.",
        )
    if claim_status == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Too many invalid attempts. Please register again.",
        )
    if claim_status == "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Verification is already being processed.",
        )
    if claim_status != "CLAIMED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Verification session is not available.",
        )

    pending = claim.get("payload")
    claim_token = str(claim["claim_token"])
    if not isinstance(pending, dict):
        try:
            await redis_cache.release_registration_claim(
                otp_in.registration_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release malformed registration claim")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification session is invalid. Please register again.",
        )

    try:
        email = _normalize_email(_required_pending_text(pending, "email"))
        role = _required_pending_text(pending, "role")
        if role not in {"STUDENT", "TEACHER"}:
            raise ValueError("Invalid pending role.")
        consent_accepted_at = _parse_consent_timestamp(
            pending.get("consent_accepted_at")
        )
        new_user = User(
            registration_id=otp_in.registration_id,
            first_name=_required_pending_text(pending, "first_name"),
            last_name=str(pending.get("last_name") or "").strip(),
            email=email,
            hashed_password=_required_pending_text(
                pending,
                "hashed_password",
            ),
            role=role,
            student_id=(str(pending["student_id"]) if pending.get("student_id") else None),
            university_name=(
                str(pending["university_name"])
                if pending.get("university_name")
                else None
            ),
            department=(
                str(pending["department"])
                if pending.get("department")
                else None
            ),
            is_verified=True,
            token_version=0,
            consent_accepted_at=consent_accepted_at,
            consent_policy_version=_required_pending_text(
                pending,
                "consent_policy_version",
            ),
            consent_source=_required_pending_text(pending, "consent_source"),
        )
    except (TypeError, ValueError, KeyError) as exc:
        try:
            await redis_cache.release_registration_claim(
                otp_in.registration_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release invalid registration claim")
        logger.exception("Pending registration payload failed validation")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification session is invalid. Please register again.",
        ) from exc

    try:
        db.add(new_user)
        await db.flush()
        db.add(
            create_audit_log(
                event_type="CONSENT_ACCEPTED",
                entity_type="USER",
                entity_id=str(new_user.id),
                actor_user_id=str(new_user.id),
                target_user_id=str(new_user.id),
                request=request,
                metadata={
                    "policy_version": new_user.consent_policy_version,
                    "accepted_at": consent_accepted_at.isoformat(),
                    "source": new_user.consent_source,
                    "registration_id": otp_in.registration_id,
                },
            )
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # A concurrent transaction or a retry may already have committed the same
        # registration. Resolve that case before reporting a uniqueness conflict.
        existing = (
            await db.execute(
                select(User).where(
                    User.registration_id == otp_in.registration_id
                )
            )
        ).scalars().first()
        if existing is not None:
            return _auth_response(
                existing,
                message="Account was already verified.",
                already_completed=True,
            )
        try:
            await redis_cache.release_registration_claim(
                otp_in.registration_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release registration after conflict")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or Student ID already exists.",
        ) from exc
    except Exception as exc:
        await db.rollback()
        try:
            await redis_cache.release_registration_claim(
                otp_in.registration_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release registration after DB failure")
        logger.exception("Account creation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account could not be created. You may retry the same code.",
        ) from exc

    try:
        completed = await redis_cache.complete_registration(
            otp_in.registration_id,
            claim_token,
            user_id=str(new_user.id),
            email=new_user.email,
            role=new_user.role,
        )
        if not completed:
            logger.error(
                "Post-commit registration cleanup returned an unsuccessful state"
            )
    except Exception:
        # PostgreSQL is authoritative after commit. Do not turn a created account
        # into a user-visible failure because cache cleanup failed.
        logger.exception(
            "Post-commit registration cleanup failed; account remains created"
        )

    return _auth_response(new_user, message="Account verified successfully.")


@router.post("/login", response_model=AuthTokenResponse)
@limiter.limit(per_minute(settings.MAX_LOGIN_ATTEMPTS_PER_MINUTE))
async def login_user(
    request: Request,
    response: Response,
    login_in: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    del request, response
    email = _normalize_email(str(login_in.email))
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalars().first()
    if user is None or not verify_password(
        login_in.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified.",
        )
    return _auth_response(user, message="Login successful.")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return _serialize_user(current_user)


@router.get("/verify-token", response_model=TokenVerifyResponse)
async def verify_token(
    current_user: User = Depends(get_current_user),
) -> TokenVerifyResponse:
    return TokenVerifyResponse(valid=True, user=_serialize_user(current_user))


@router.post("/logout", response_model=MessageResponse)
async def logout_user() -> MessageResponse:
    return MessageResponse(message="Logged out successfully.")


@router.post(
    "/password-reset/request",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=PasswordResetRequestResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def request_password_reset(
    request: Request,
    response: Response,
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetRequestResponse:
    del request, response
    email = _normalize_email(str(req.email))
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalars().first()

    otp = generate_otp()
    try:
        reset = await redis_cache.create_password_reset(
            email=email,
            otp=otp,
            user_id=str(user.id) if user is not None else None,
        )
    except Exception as exc:
        logger.exception("Unable to create password-reset session")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password-reset service is temporarily unavailable.",
        ) from exc

    # Always return an opaque reset ID. Missing accounts receive an unusable
    # decoy session so the normal response does not expose account existence.
    if user is not None:
        try:
            await send_otp_email(
                email=user.email,
                otp=otp,
                purpose="password reset",
                action_url=_frontend_recovery_url(
                    "/forgot-password",
                    "reset_id",
                    str(reset["reset_id"]),
                ),
            )
        except EmailDeliveryError as exc:
            try:
                deleted = await redis_cache.delete_password_reset(reset["reset_id"])
                if not deleted:
                    logger.error(
                        "Undelivered password-reset session was already absent"
                    )
            except Exception:
                logger.exception("Failed to remove undelivered reset session")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Reset email could not be delivered. Please try again.",
            ) from exc

    return PasswordResetRequestResponse(
        message="If that email exists, a reset code has been sent.",
        reset_id=str(reset["reset_id"]),
        expires_in_seconds=redis_cache.RESET_TTL_SECONDS,
    )


@router.get(
    "/password-reset/{reset_id}",
    response_model=PasswordResetStatusResponse,
)
async def password_reset_status(
    reset_id: str = RESET_ID_PATH,
) -> PasswordResetStatusResponse:
    try:
        result = await redis_cache.get_password_reset_status(reset_id)
    except Exception as exc:
        logger.exception("Unable to read password-reset status")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password-reset service is temporarily unavailable.",
        ) from exc
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Password-reset session expired. Start again.",
        )
    return PasswordResetStatusResponse.model_validate(result)


@router.delete("/password-reset/{reset_id}", response_model=MessageResponse)
async def cancel_password_reset(
    reset_id: str = RESET_ID_PATH,
) -> MessageResponse:
    try:
        result = await redis_cache.cancel_password_reset(reset_id)
    except Exception as exc:
        logger.exception("Password-reset cancellation failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not cancel the reset session. It will expire automatically.",
        ) from exc
    if result["status"] == "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password update is already being processed.",
        )
    if result["status"] == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password reset has already completed.",
        )
    return MessageResponse(
        message=(
            "Password-reset session cancelled."
            if result["status"] == "CANCELLED"
            else "Password-reset session was already absent."
        )
    )


@router.post(
    "/password-reset/verify",
    response_model=PasswordResetVerifyResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def verify_password_reset(
    request: Request,
    response: Response,
    req: PasswordResetVerify,
) -> PasswordResetVerifyResponse:
    del request, response
    proposed_jti = str(uuid4())
    try:
        result = await redis_cache.verify_password_reset_otp(
            req.reset_id,
            req.otp,
            proposed_jti=proposed_jti,
        )
    except Exception as exc:
        logger.exception("Password-reset OTP verification failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password-reset service is temporarily unavailable.",
        ) from exc

    state = result["status"]
    if state == "MISSING":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invalid or expired reset code.",
        )
    if state == "INVALID":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset code.",
        )
    if state == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Too many invalid attempts. Start password reset again.",
        )
    if state in {"COMPLETED", "IN_PROGRESS"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password reset is no longer available.",
        )
    if state != "ISSUED" or not isinstance(result.get("payload"), dict):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password-reset session is not available.",
        )

    payload = result["payload"]
    user_id = payload.get("user_id")
    email = payload.get("email")
    token_jti = payload.get("token_jti")
    if not user_id or not email or not token_jti:
        # Decoy sessions and malformed state receive the same generic result.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset code.",
        )

    token, _ = create_reset_token(
        str(email),
        user_id=str(user_id),
        reset_id=req.reset_id,
        jti=str(token_jti),
    )
    return PasswordResetVerifyResponse(
        reset_token=token,
        message="Code verified.",
    )


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
)
@limiter.limit(per_minute(settings.MAX_OTP_ATTEMPTS_PER_MINUTE))
async def confirm_password_reset(
    request: Request,
    response: Response,
    req: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    del response
    try:
        payload = decode_reset_token(req.reset_token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session.",
        ) from exc

    try:
        claim = await redis_cache.claim_password_reset(
            str(payload["reset_id"]),
            str(payload["jti"]),
        )
    except Exception as exc:
        logger.exception("Password-reset token claim failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password-reset service is temporarily unavailable.",
        ) from exc

    claim_state = claim["status"]
    if claim_state in {"MISSING", "INVALID", "COMPLETED"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Reset session has already been used or expired.",
        )
    if claim_state == "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password reset is already being processed.",
        )
    if claim_state != "CLAIMED" or not isinstance(claim.get("payload"), dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session.",
        )

    reset_state = claim["payload"]
    claim_token = str(claim["claim_token"])
    reset_id = str(payload["reset_id"])
    state_user_id = str(reset_state.get("user_id") or "")
    state_email = _normalize_email(str(reset_state.get("email") or ""))
    token_user_id = str(payload["user_id"])
    token_email = _normalize_email(str(payload["sub"]))
    if state_user_id != token_user_id or state_email != token_email:
        try:
            await redis_cache.release_password_reset_claim(
                reset_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release mismatched reset claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session.",
        )

    user = (
        await db.execute(
            select(User)
            .where(
                User.id == token_user_id,
                User.email == token_email,
            )
            .with_for_update()
        )
    ).scalars().first()
    if user is None or not user.is_verified:
        try:
            await redis_cache.release_password_reset_claim(
                reset_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release reset claim for absent user")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session.",
        )

    if user.last_password_reset_id == reset_id:
        try:
            completed = await redis_cache.complete_password_reset(
                reset_id,
                claim_token,
            )
            if not completed:
                logger.error(
                    "Idempotent password-reset finalization returned false"
                )
        except Exception:
            logger.exception("Failed to finalize idempotent password reset")
        return MessageResponse(
            message="Password was already updated successfully. Sign in again."
        )

    if verify_password(req.new_password, user.hashed_password):
        try:
            await redis_cache.release_password_reset_claim(
                reset_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to release unchanged-password reset claim")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    try:
        user.hashed_password = get_password_hash(req.new_password)
        user.token_version = int(user.token_version or 0) + 1
        user.last_password_reset_id = reset_id
        db.add(user)
        db.add(
            create_audit_log(
                event_type="PASSWORD_RESET",
                entity_type="USER",
                entity_id=str(user.id),
                actor_user_id=str(user.id),
                target_user_id=str(user.id),
                request=request,
                metadata={"reset_id": reset_id},
            )
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        try:
            await redis_cache.release_password_reset_claim(
                reset_id,
                claim_token,
            )
        except Exception:
            logger.exception("Failed to restore reset token after DB failure")
        logger.exception("Password-reset database commit failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password could not be updated. You may retry this reset session.",
        ) from exc

    try:
        completed = await redis_cache.complete_password_reset(
            reset_id,
            claim_token,
        )
        if not completed:
            logger.error(
                "Post-commit password-reset cleanup returned an unsuccessful state"
            )
    except Exception:
        # The password and token_version are already committed. A cache failure
        # must not turn the completed security change into an apparent failure.
        logger.exception(
            "Post-commit password-reset cleanup failed; reset remains successful"
        )

    return MessageResponse(
        message="Password updated successfully. Sign in again on all devices."
    )
