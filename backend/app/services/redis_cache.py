# backend/app/services/redis_cache.py
import json
import redis.asyncio as redis
from typing import Optional, Union
from app.schemas.user import StudentRegister, TeacherRegister

redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
OTP_EXPIRATION_SECONDS = 600  # 10 minutes


async def store_pending_user(
    user_data: Union[StudentRegister, TeacherRegister],
    otp: str,
    hashed_password: str,
) -> bool:
    """
    Stores registration data + OTP in Redis for OTP verification.
    Supports both StudentRegister and TeacherRegister payloads.
    The `role` field is always included so verify-otp knows which DB columns to fill.
    """
    redis_key = f"pending_user:{user_data.email}"

    payload: dict = {
        "role": user_data.role,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "email": user_data.email,
        "hashed_password": hashed_password,
        "consent": user_data.consent,
        "otp": otp,
        # Student-specific (None for teachers)
        "student_id": getattr(user_data, "student_id", None),
        "university_name": getattr(user_data, "university_name", None),
        # Teacher-specific (None for students)
        "department": getattr(user_data, "department", None),
    }

    success = await redis_client.set(
        name=redis_key,
        value=json.dumps(payload),
        ex=OTP_EXPIRATION_SECONDS,
    )
    return bool(success)


async def get_pending_user(email: str) -> Optional[dict]:
    redis_key = f"pending_user:{email}"
    data = await redis_client.get(redis_key)
    return json.loads(data) if data else None


async def delete_pending_user(email: str) -> None:
    await redis_client.delete(f"pending_user:{email}")


async def store_reset_otp(email: str, otp: str) -> bool:
    success = await redis_client.set(
        name=f"reset_otp:{email}", value=otp, ex=600
    )
    return bool(success)


async def get_reset_otp(email: str) -> Optional[str]:
    return await redis_client.get(f"reset_otp:{email}")


async def delete_reset_otp(email: str) -> None:
    await redis_client.delete(f"reset_otp:{email}")