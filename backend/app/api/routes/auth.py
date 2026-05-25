# backend/app/api/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import Union
from pydantic import ValidationError

from app.schemas.user import (
    StudentRegister,
    TeacherRegister,
    OTPVerify,
    UserLogin,
    PasswordResetRequest,
    PasswordResetVerify,
    PasswordResetConfirm,
)
from app.core.jwt import create_access_token, create_reset_token, verify_reset_token
from app.core.security import get_password_hash, verify_password, generate_otp
from app.services import redis_cache
from app.db.database import get_db
from app.models.user import User

router = APIRouter()


# ─── 1. REGISTRATION ──────────────────────────────────────────────────────────
# We accept a raw dict first, read the `role` discriminator, then validate
# against the correct schema. This gives clean per-role validation errors.

@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    role = body.get("role", "STUDENT").upper()

    # Parse into the correct schema based on role
    try:
        if role == "TEACHER":
            user_in: Union[StudentRegister, TeacherRegister] = TeacherRegister(**body)
        else:
            user_in = StudentRegister(**body)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

    # Check for existing email
    query = select(User).where(User.email == user_in.email)
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # For students, also check student_id uniqueness
    if role == "STUDENT" and isinstance(user_in, StudentRegister):
        sid_query = select(User).where(User.student_id == user_in.student_id)
        sid_result = await db.execute(sid_query)
        if sid_result.scalars().first():
            raise HTTPException(status_code=400, detail="Student ID already registered")

    hashed_pwd = get_password_hash(user_in.password)
    otp = generate_otp()

    success = await redis_cache.store_pending_user(user_in, otp, hashed_pwd)
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to process registration. Please try again.",
        )

    from app.services import email as email_service
    await email_service.send_otp_email(email=user_in.email, otp=otp)

    return {
        "message": "OTP sent to your email. Please verify to complete registration.",
        "role": role,
    }


# ─── 2. OTP VERIFICATION ──────────────────────────────────────────────────────

@router.post("/verify-otp", status_code=status.HTTP_201_CREATED)
async def verify_otp(
    request: Request,
    otp_in: OTPVerify,
    db: AsyncSession = Depends(get_db),
):
    pending_user = await redis_cache.get_pending_user(otp_in.email)

    if not pending_user:
        raise HTTPException(
            status_code=400,
            detail="Verification session expired or invalid. Please register again.",
        )

    if pending_user["otp"] != otp_in.otp:
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    role = pending_user.get("role", "STUDENT")

    new_db_user = User(
        first_name=pending_user["first_name"],
        last_name=pending_user["last_name"],
        email=pending_user["email"],
        hashed_password=pending_user["hashed_password"],
        role=role,
        # Student-specific — None for teachers
        student_id=pending_user.get("student_id"),
        university_name=pending_user.get("university_name"),
        # Teacher-specific — None for students
        department=pending_user.get("department"),
        is_verified=True,
    )

    try:
        db.add(new_db_user)
        await db.commit()
        await db.refresh(new_db_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="An account with this email or Student ID already exists.",
        )

    await redis_cache.delete_pending_user(otp_in.email)

    # JWT now carries the role so every backend endpoint can RBAC-check it
    access_token = create_access_token(
        data={
            "sub": new_db_user.email,
            "id": new_db_user.id,
            "role": new_db_user.role,
        }
    )

    return {
        "message": "Account verified successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_db_user.id,
            "first_name": new_db_user.first_name,
            "email": new_db_user.email,
            "role": new_db_user.role,
        },
    }


# ─── 3. LOGIN ─────────────────────────────────────────────────────────────────

@router.post("/login", status_code=status.HTTP_200_OK)
async def login_user(
    request: Request,
    login_in: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.email == login_in.email)
    result = await db.execute(query)
    user = result.scalars().first()

    # Generic message — never hint whether the email exists
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={
            "sub": user.email,
            "id": user.id,
            "role": user.role,   # ← RBAC claim in every token
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "email": user.email,
            "role": user.role,   # ← Frontend reads this for routing
        },
    }


# ─── 4. PASSWORD RESET (unchanged logic, just re-exported here) ───────────────

@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
async def request_password_reset(
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.email == req.email)
    result = await db.execute(query)
    user = result.scalars().first()

    if user:
        otp = generate_otp()
        await redis_cache.store_reset_otp(req.email, otp)
        from app.services import email as email_service
        await email_service.send_otp_email(email=req.email, otp=otp)

    # Always 200 — prevents email enumeration
    return {"message": "If that email exists, a reset code has been sent."}


@router.post("/password-reset/verify", status_code=status.HTTP_200_OK)
async def verify_password_reset(req: PasswordResetVerify):
    saved_otp = await redis_cache.get_reset_otp(req.email)
    if not saved_otp or saved_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    reset_token = create_reset_token(req.email)
    await redis_cache.delete_reset_otp(req.email)
    return {"reset_token": reset_token, "message": "Code verified."}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    req: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
):
    if not verify_reset_token(req.reset_token, req.email):
        raise HTTPException(status_code=401, detail="Invalid or expired reset session.")

    query = select(User).where(User.email == req.email)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = get_password_hash(req.new_password)
    db.add(user)
    await db.commit()

    return {"message": "Password updated successfully."}