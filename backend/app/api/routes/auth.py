from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError # <-- NEW IMPORT

from app.schemas.user import PasswordResetRequest, PasswordResetVerify, PasswordResetConfirm
from app.core.jwt import create_access_token, create_reset_token, verify_reset_token
from app.schemas.user import UserCreate, OTPVerify, UserLogin, UserResponse
from app.core.security import get_password_hash, verify_password, generate_otp
from app.services import redis_cache
from app.db.database import get_db
from app.models.user import User
from app.core.jwt import create_access_token

router = APIRouter()

# ─── 1. REGISTRATION (The Holding Pen) ────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register_user(
    request: Request, 
    user_in: UserCreate, 
    db: AsyncSession = Depends(get_db)
):
    # async query to check if email OR student_id already exists
    # professor wants us to catch duplicates early before wasting money on SMTP emails
    query = select(User).where(
        or_(User.email == user_in.email, User.student_id == user_in.student_id)
    )
    result = await db.execute(query)
    existing_user = result.scalars().first()
    
    if existing_user:
        if existing_user.email == user_in.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        else:
            raise HTTPException(status_code=400, detail="Student ID already registered")

    hashed_pwd = get_password_hash(user_in.password)
    otp = generate_otp()

    # save to redis with 10 mins expire
    success = await redis_cache.store_pending_user(user_in, otp, hashed_pwd)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to process registration"
        )

    # Actually send the email using our SMTP service
    from app.services import email
    await email.send_otp_email(email=user_in.email, otp=otp)

    return {"message": "OTP sent to email. Awaiting verification."}


# ─── 2. OTP VERIFICATION (The Database Commit) ────────────────────────────────

@router.post("/verify-otp", status_code=status.HTTP_201_CREATED)
async def verify_otp(
    request: Request, 
    otp_in: OTPVerify, 
    db: AsyncSession = Depends(get_db)
):
    pending_user = await redis_cache.get_pending_user(otp_in.email)
    
    if not pending_user:
        raise HTTPException(status_code=400, detail="Verification session expired or invalid")

    if pending_user["otp"] != otp_in.otp:
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    new_db_user = User(
        first_name=pending_user["first_name"],
        last_name=pending_user["last_name"],
        student_id=pending_user["student_id"],
        email=pending_user["email"],
        hashed_password=pending_user["hashed_password"], 
        is_verified=True
    )
    
    # Try/Catch block to gracefully handle any race conditions where a duplicate 
    # sneaks past the initial registration check.
    try:
        db.add(new_db_user)
        await db.commit()
        await db.refresh(new_db_user)
    except IntegrityError:
        await db.rollback() # always rollback a failed transaction!
        raise HTTPException(status_code=400, detail="Account with this Email or Student ID already exists.")

    # clean up the holding pen immediately
    await redis_cache.delete_pending_user(otp_in.email)

    # Generate JWT Token
    access_token = create_access_token(
        data={"sub": new_db_user.email, "id": new_db_user.id}
    )

    return {
        "message": "Account verified successfully",
        "access_token": access_token,
        "user": {
            "id": new_db_user.id,
            "first_name": new_db_user.first_name,
            "email": new_db_user.email
        },
        "token_type": "bearer"
    }


# ─── 3. LOGIN ─────────────────────────────────────────────────────────────────

@router.post("/login", status_code=status.HTTP_200_OK)
async def login_user(
    request: Request, 
    login_in: UserLogin, 
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.email == login_in.email)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={"sub": user.email, "id": user.id}
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "email": user.email
        },
        "token_type": "bearer"
    }
    
# ─── 4. PASSWORD RESET FLOW ───────────────────────────────────────────────────

@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
async def request_password_reset(
    req: PasswordResetRequest, 
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(User.email == req.email)
    result = await db.execute(query)
    user = result.scalars().first()
    
    # we always return 200 OK, but we only actually send the email if the user exists.
    if user:
        otp = generate_otp()
        await redis_cache.store_reset_otp(req.email, otp)
        from app.services import email
        await email.send_otp_email(email=req.email, otp=otp)
        print(f"\n[SECURITY LOG] -> Sent Password Reset OTP {otp} to {req.email}\n")
        
    return {"message": "If that email exists, a reset code has been sent."}


@router.post("/password-reset/verify", status_code=status.HTTP_200_OK)
async def verify_password_reset(req: PasswordResetVerify):
    saved_otp = await redis_cache.get_reset_otp(req.email)
    
    if not saved_otp or saved_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")
        
    # they passed the check! give them the temporary pass to change their password
    reset_token = create_reset_token(req.email)
    
    # clean up the cache so the OTP cant be reused
    await redis_cache.delete_reset_otp(req.email)
    
    return {"reset_token": reset_token, "message": "Code verified."}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    req: PasswordResetConfirm, 
    db: AsyncSession = Depends(get_db)
):
    # Validate the temporary pass
    if not verify_reset_token(req.reset_token, req.email):
        raise HTTPException(status_code=401, detail="Invalid or expired reset session.")
        
    query = select(User).where(User.email == req.email)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # The moment of truth: update the database with the new hashed password
    user.hashed_password = get_password_hash(req.new_password)
    db.add(user)
    await db.commit()
    
    return {"message": "Password updated successfully."}