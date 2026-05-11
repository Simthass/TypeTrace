# backend/app/services/redis_cache.py
import json
import redis.asyncio as redis
from typing import Optional
from app.schemas.user import UserCreate

# connecting to local redis server. 
# TODO: move this to .env file before deploying to production!
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# 10 minutes time-to-live. exactly 600 seconds.
OTP_EXPIRATION_SECONDS = 600 

async def store_pending_user(user_data: UserCreate, otp: str, hashed_password: str) -> bool:
    """
    Stores user registration data and OTP in Redis temporarily.
    If they dont verify in 10 mins, it vanishes automatically. Zero database bloat!
    """
    redis_key = f"pending_user:{user_data.email}"
    
    # packing everything into a dictionary to save as a json string
    payload = {
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "student_id": user_data.student_id,
        "email": user_data.email,
        "hashed_password": hashed_password,  # saving the HASH, never plain text
        "consent": user_data.consent,
        "otp": otp
    }
    
    # saving to redis with an EX (expire) timer.
    # it returns True if successful
    success = await redis_client.set(
        name=redis_key, 
        value=json.dumps(payload), 
        ex=OTP_EXPIRATION_SECONDS
    )
    return success

async def get_pending_user(email: str) -> Optional[dict]:
    """
    Retrieves the pending user payload from Redis during verification.
    """
    redis_key = f"pending_user:{email}"
    data = await redis_client.get(redis_key)
    
    if data:
        return json.loads(data)
    return None

async def delete_pending_user(email: str) -> None:
    """
    Cleans up the cache immediately after successful verification.
    """
    redis_key = f"pending_user:{email}"
    await redis_client.delete(redis_key)
    

async def store_reset_otp(email: str, otp: str) -> bool:
    """
    Storing reset otp separately so it doesnt mess with registration otps.
    """
    redis_key = f"reset_otp:{email}"
    # only saving the otp string directly, no need for complex json here
    success = await redis_client.set(name=redis_key, value=otp, ex=600)
    return success

async def get_reset_otp(email: str) -> Optional[str]:
    redis_key = f"reset_otp:{email}"
    data = await redis_client.get(redis_key)
    return data

async def delete_reset_otp(email: str) -> None:
    redis_key = f"reset_otp:{email}"
    await redis_client.delete(redis_key)