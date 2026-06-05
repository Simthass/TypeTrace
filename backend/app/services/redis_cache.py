# backend/app/services/redis_cache.py

import json
from typing import Optional, Union

import redis.asyncio as redis

from app.core.config import settings
from app.schemas.user import StudentRegister, TeacherRegister


redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True,
)

OTP_EXPIRATION_SECONDS = 600


async def store_pending_user(
    user_data: Union[StudentRegister, TeacherRegister],
    otp: str,
    hashed_password: str,
) -> bool:
    redis_key = f"pending_user:{user_data.email}"

    payload: dict = {
        "role": user_data.role,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "email": user_data.email,
        "hashed_password": hashed_password,
        "consent": user_data.consent,
        "otp": otp,
        "student_id": getattr(user_data, "student_id", None),
        "university_name": getattr(user_data, "university_name", None),
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

    if not data:
        return None

    return json.loads(data)


async def delete_pending_user(email: str) -> None:
    redis_key = f"pending_user:{email}"
    await redis_client.delete(redis_key)


async def store_reset_otp(email: str, otp: str) -> bool:
    redis_key = f"reset_otp:{email}"
    success = await redis_client.set(
        name=redis_key,
        value=otp,
        ex=OTP_EXPIRATION_SECONDS,
    )

    return bool(success)


async def get_reset_otp(email: str) -> Optional[str]:
    redis_key = f"reset_otp:{email}"
    return await redis_client.get(redis_key)


async def delete_reset_otp(email: str) -> None:
    redis_key = f"reset_otp:{email}"
    await redis_client.delete(redis_key)