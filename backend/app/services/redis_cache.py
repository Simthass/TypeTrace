from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import Any, Optional, Union

import redis.asyncio as redis

from app.core.config import settings
from app.schemas.user import StudentRegister, TeacherRegister


class RedisStateError(RuntimeError):
    """Raised when authentication state in Redis is malformed or inconsistent."""


class ActiveRegistrationError(RedisStateError):
    """Raised when an unexpired registration already exists for an email."""


if settings.REDIS_URL:
    redis_client = redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        health_check_interval=30,
    )
else:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        health_check_interval=30,
    )

REGISTRATION_TTL_SECONDS = 600
COMPLETED_REGISTRATION_TTL_SECONDS = 86_400
RESET_TTL_SECONDS = 600
MAX_OTP_ATTEMPTS = 5
MAX_RESENDS = 3
RESEND_COOLDOWN_SECONDS = 60
CLAIM_TIMEOUT_SECONDS = 120
RESEND_RESERVATION_TIMEOUT_SECONDS = 120
CONSENT_POLICY_VERSION = "typetrace-consent-v1"


def _utc_timestamp() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _otp_hash(otp: str) -> str:
    key = settings.SECRET_KEY.encode("utf-8")
    if not key:
        raise RedisStateError("SECRET_KEY is required for OTP hashing.")
    return hmac.new(key, otp.encode("utf-8"), hashlib.sha256).hexdigest()


def _email_fingerprint(email: str) -> str:
    key = settings.SECRET_KEY.encode("utf-8")
    if not key:
        raise RedisStateError("SECRET_KEY is required for registration indexing.")
    return hmac.new(
        key,
        email.strip().lower().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _registration_key(registration_id: str) -> str:
    return f"pending_registration:{registration_id}"


def _registration_email_key(email: str) -> str:
    return f"pending_registration_email:{_email_fingerprint(email)}"


def _completed_key(registration_id: str) -> str:
    return f"completed_registration:{registration_id}"


def _reset_key(reset_id: str) -> str:
    return f"password_reset:{reset_id}"


def _decode_object(raw: Optional[str], *, label: str) -> Optional[dict[str, Any]]:
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RedisStateError(f"Malformed {label} state.") from exc
    if not isinstance(value, dict):
        raise RedisStateError(f"Invalid {label} state type.")
    return value


def _decode_script_result(raw: Any, *, label: str) -> dict[str, Any]:
    value = _decode_object(str(raw) if raw is not None else None, label=label)
    if value is None or not isinstance(value.get("status"), str):
        raise RedisStateError(f"Invalid {label} script response.")
    return value


_CREATE_REGISTRATION_SCRIPT = """
local pending_key = KEYS[1]
local email_key = KEYS[2]
local payload = ARGV[1]
local registration_id = ARGV[2]
local ttl = tonumber(ARGV[3])
if redis.call('EXISTS', email_key) == 1 then
  return cjson.encode({status='ACTIVE'})
end
if redis.call('SET', pending_key, payload, 'EX', ttl, 'NX') == false then
  return cjson.encode({status='COLLISION'})
end
redis.call('SET', email_key, registration_id, 'EX', ttl)
return cjson.encode({status='CREATED'})
"""


async def create_pending_registration(
    user_data: Union[StudentRegister, TeacherRegister],
    otp: str,
    hashed_password: str,
) -> dict[str, Any]:
    registration_id = f"reg_{secrets.token_urlsafe(48)}"
    now = _utc_timestamp()
    email = str(user_data.email).strip().lower()
    payload: dict[str, Any] = {
        "registration_id": registration_id,
        "role": user_data.role,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "email": email,
        "hashed_password": hashed_password,
        "student_id": getattr(user_data, "student_id", None),
        "university_name": getattr(user_data, "university_name", None),
        "department": getattr(user_data, "department", None),
        "otp_hash": _otp_hash(otp),
        "attempt_count": 0,
        "resend_count": 0,
        "last_sent_at": now,
        "created_at": now,
        "expires_at": now + REGISTRATION_TTL_SECONDS,
        "consent_accepted_at": datetime.now(timezone.utc).isoformat(),
        "consent_policy_version": CONSENT_POLICY_VERSION,
        "consent_source": "web_registration",
        "state": "PENDING",
        "claim_token": None,
        "claim_started_at": None,
        "resend_reservation_token": None,
        "resend_candidate_hash": None,
        "resend_reserved_at": None,
    }
    raw = await redis_client.eval(
        _CREATE_REGISTRATION_SCRIPT,
        2,
        _registration_key(registration_id),
        _registration_email_key(email),
        json.dumps(payload, separators=(",", ":")),
        registration_id,
        REGISTRATION_TTL_SECONDS,
    )
    result = _decode_script_result(raw, label="registration creation")
    if result["status"] == "ACTIVE":
        raise ActiveRegistrationError(
            "An active registration already exists for this email address."
        )
    if result["status"] != "CREATED":
        raise RedisStateError("Unable to create a unique registration session.")
    return payload


async def get_pending_registration(
    registration_id: str,
) -> Optional[dict[str, Any]]:
    return _decode_object(
        await redis_client.get(_registration_key(registration_id)),
        label="pending registration",
    )


_CANCEL_REGISTRATION_SCRIPT = """
local pending_key = KEYS[1]
local completed_key = KEYS[2]
local email_key = KEYS[3]
local registration_id = ARGV[1]
if redis.call('EXISTS', completed_key) == 1 then
  return cjson.encode({status='COMPLETED'})
end
local raw = redis.call('GET', pending_key)
if not raw then
  return cjson.encode({status='MISSING'})
end
local data = cjson.decode(raw)
if data.state == 'CLAIMED' then
  return cjson.encode({status='IN_PROGRESS'})
end
redis.call('DEL', pending_key)
if redis.call('GET', email_key) == registration_id then
  redis.call('DEL', email_key)
end
return cjson.encode({status='CANCELLED'})
"""


async def cancel_pending_registration(registration_id: str) -> dict[str, Any]:
    pending = await get_pending_registration(registration_id)
    email = str(pending.get("email")) if pending else "missing@invalid.local"
    raw = await redis_client.eval(
        _CANCEL_REGISTRATION_SCRIPT,
        3,
        _registration_key(registration_id),
        _completed_key(registration_id),
        _registration_email_key(email),
        registration_id,
    )
    return _decode_script_result(raw, label="registration cancellation")


_CLAIM_REGISTRATION_SCRIPT = """
local key = KEYS[1]
local expected = ARGV[1]
local claim = ARGV[2]
local max_attempts = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local claim_timeout = tonumber(ARGV[5])
local raw = redis.call('GET', key)
if not raw then return cjson.encode({status='MISSING'}) end
local data = cjson.decode(raw)
if data.state == 'LOCKED' then return cjson.encode({status='LOCKED'}) end
if data.state == 'CLAIMED' then
  local started = tonumber(data.claim_started_at) or now
  if now - started < claim_timeout then
    return cjson.encode({status='IN_PROGRESS'})
  end
  data.state = 'PENDING'
  data.claim_token = cjson.null
  data.claim_started_at = cjson.null
end
if data.state ~= 'PENDING' then
  return cjson.encode({status='INVALID_STATE'})
end
if data.otp_hash ~= expected then
  data.attempt_count = (tonumber(data.attempt_count) or 0) + 1
  if data.attempt_count >= max_attempts then
    data.state = 'LOCKED'
    local ttl = redis.call('TTL', key)
    redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
    return cjson.encode({status='LOCKED', attempts=data.attempt_count})
  end
  local ttl = redis.call('TTL', key)
  redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
  return cjson.encode({status='INVALID', attempts=data.attempt_count})
end
data.state = 'CLAIMED'
data.claim_token = claim
data.claim_started_at = now
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return cjson.encode({status='CLAIMED', payload=data})
"""


async def claim_registration(registration_id: str, otp: str) -> dict[str, Any]:
    claim_token = secrets.token_urlsafe(32)
    raw = await redis_client.eval(
        _CLAIM_REGISTRATION_SCRIPT,
        1,
        _registration_key(registration_id),
        _otp_hash(otp),
        claim_token,
        MAX_OTP_ATTEMPTS,
        _utc_timestamp(),
        CLAIM_TIMEOUT_SECONDS,
    )
    result = _decode_script_result(raw, label="registration claim")
    if result["status"] == "CLAIMED":
        result["claim_token"] = claim_token
    return result


_RELEASE_REGISTRATION_SCRIPT = """
local key = KEYS[1]
local claim = ARGV[1]
local raw = redis.call('GET', key)
if not raw then return 0 end
local data = cjson.decode(raw)
if data.state ~= 'CLAIMED' or data.claim_token ~= claim then return 0 end
data.state = 'PENDING'
data.claim_token = cjson.null
data.claim_started_at = cjson.null
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return 1
"""


async def release_registration_claim(
    registration_id: str,
    claim_token: str,
) -> bool:
    return bool(
        await redis_client.eval(
            _RELEASE_REGISTRATION_SCRIPT,
            1,
            _registration_key(registration_id),
            claim_token,
        )
    )


_COMPLETE_REGISTRATION_SCRIPT = """
local pending_key = KEYS[1]
local completed_key = KEYS[2]
local email_key = KEYS[3]
local claim = ARGV[1]
local completed_payload = ARGV[2]
local completed_ttl = tonumber(ARGV[3])
local registration_id = ARGV[4]
local raw = redis.call('GET', pending_key)
if not raw then
  if redis.call('EXISTS', completed_key) == 1 then return 1 end
  return 0
end
local data = cjson.decode(raw)
if data.state ~= 'CLAIMED' or data.claim_token ~= claim then return 0 end
redis.call('SET', completed_key, completed_payload, 'EX', completed_ttl)
redis.call('DEL', pending_key)
if redis.call('GET', email_key) == registration_id then
  redis.call('DEL', email_key)
end
return 1
"""


async def complete_registration(
    registration_id: str,
    claim_token: str,
    *,
    user_id: str,
    email: str,
    role: str,
) -> bool:
    completed_payload = json.dumps(
        {
            "registration_id": registration_id,
            "user_id": user_id,
            "email": email,
            "role": role,
            "state": "COMPLETED",
            "completed_at": _utc_timestamp(),
        },
        separators=(",", ":"),
    )
    return bool(
        await redis_client.eval(
            _COMPLETE_REGISTRATION_SCRIPT,
            3,
            _registration_key(registration_id),
            _completed_key(registration_id),
            _registration_email_key(email),
            claim_token,
            completed_payload,
            COMPLETED_REGISTRATION_TTL_SECONDS,
            registration_id,
        )
    )



async def get_registration_status(
    registration_id: str,
) -> Optional[dict[str, Any]]:
    completed = _decode_object(
        await redis_client.get(_completed_key(registration_id)),
        label="completed registration",
    )
    if completed is not None:
        return {
            "registration_id": registration_id,
            "email": completed["email"],
            "role": completed["role"],
            "state": "COMPLETED",
            "expires_in_seconds": max(
                int(await redis_client.ttl(_completed_key(registration_id))), 0
            ),
            "attempts_remaining": 0,
            "resends_remaining": 0,
            "resend_available_in_seconds": 0,
        }

    pending = await get_pending_registration(registration_id)
    if pending is None:
        return None
    ttl = max(int(await redis_client.ttl(_registration_key(registration_id))), 0)
    now = _utc_timestamp()
    last_sent = int(pending.get("last_sent_at") or 0)
    cooldown = max(RESEND_COOLDOWN_SECONDS - (now - last_sent), 0)
    return {
        "registration_id": registration_id,
        "email": pending["email"],
        "role": pending["role"],
        "state": str(pending.get("state") or "PENDING"),
        "expires_in_seconds": ttl,
        "attempts_remaining": max(
            MAX_OTP_ATTEMPTS - int(pending.get("attempt_count") or 0), 0
        ),
        "resends_remaining": max(
            MAX_RESENDS - int(pending.get("resend_count") or 0), 0
        ),
        "resend_available_in_seconds": cooldown,
    }


_PREPARE_RESEND_SCRIPT = """
local key = KEYS[1]
local reservation = ARGV[1]
local candidate_hash = ARGV[2]
local now = tonumber(ARGV[3])
local cooldown = tonumber(ARGV[4])
local max_resends = tonumber(ARGV[5])
local reservation_timeout = tonumber(ARGV[6])
local raw = redis.call('GET', key)
if not raw then return cjson.encode({status='MISSING'}) end
local data = cjson.decode(raw)
if data.state == 'LOCKED' then return cjson.encode({status='LOCKED'}) end
if data.state ~= 'PENDING' then return cjson.encode({status='IN_PROGRESS'}) end
if data.resend_reservation_token ~= nil and data.resend_reservation_token ~= cjson.null then
  local reserved_at = tonumber(data.resend_reserved_at) or now
  if now - reserved_at < reservation_timeout then
    return cjson.encode({status='IN_PROGRESS'})
  end
  data.resend_reservation_token = cjson.null
  data.resend_candidate_hash = cjson.null
  data.resend_reserved_at = cjson.null
end
local wait = cooldown - (now - (tonumber(data.last_sent_at) or 0))
if wait > 0 then return cjson.encode({status='COOLDOWN', retry_after=wait}) end
if (tonumber(data.resend_count) or 0) >= max_resends then
  return cjson.encode({status='LIMIT'})
end
data.resend_reservation_token = reservation
data.resend_candidate_hash = candidate_hash
data.resend_reserved_at = now
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return cjson.encode({status='READY', email=data.email})
"""


async def prepare_registration_resend(
    registration_id: str,
    otp: str,
) -> dict[str, Any]:
    reservation_token = secrets.token_urlsafe(32)
    raw = await redis_client.eval(
        _PREPARE_RESEND_SCRIPT,
        1,
        _registration_key(registration_id),
        reservation_token,
        _otp_hash(otp),
        _utc_timestamp(),
        RESEND_COOLDOWN_SECONDS,
        MAX_RESENDS,
        RESEND_RESERVATION_TIMEOUT_SECONDS,
    )
    result = _decode_script_result(raw, label="registration resend preparation")
    if result["status"] == "READY":
        result["reservation_token"] = reservation_token
    return result


_COMMIT_RESEND_SCRIPT = """
local key = KEYS[1]
local reservation = ARGV[1]
local now = tonumber(ARGV[2])
local raw = redis.call('GET', key)
if not raw then return 0 end
local data = cjson.decode(raw)
if data.state ~= 'PENDING' or data.resend_reservation_token ~= reservation then
  return 0
end
data.otp_hash = data.resend_candidate_hash
data.resend_count = (tonumber(data.resend_count) or 0) + 1
data.last_sent_at = now
data.resend_reservation_token = cjson.null
data.resend_candidate_hash = cjson.null
data.resend_reserved_at = cjson.null
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return 1
"""


async def commit_registration_resend(
    registration_id: str,
    reservation_token: str,
) -> bool:
    return bool(
        await redis_client.eval(
            _COMMIT_RESEND_SCRIPT,
            1,
            _registration_key(registration_id),
            reservation_token,
            _utc_timestamp(),
        )
    )


_ABORT_RESEND_SCRIPT = """
local key = KEYS[1]
local reservation = ARGV[1]
local raw = redis.call('GET', key)
if not raw then return 0 end
local data = cjson.decode(raw)
if data.resend_reservation_token ~= reservation then return 0 end
data.resend_reservation_token = cjson.null
data.resend_candidate_hash = cjson.null
data.resend_reserved_at = cjson.null
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return 1
"""


async def abort_registration_resend(
    registration_id: str,
    reservation_token: str,
) -> bool:
    return bool(
        await redis_client.eval(
            _ABORT_RESEND_SCRIPT,
            1,
            _registration_key(registration_id),
            reservation_token,
        )
    )


async def create_password_reset(
    *,
    email: str,
    otp: str,
    user_id: Optional[str],
) -> dict[str, Any]:
    reset_id = f"rst_{secrets.token_urlsafe(48)}"
    now = _utc_timestamp()
    payload: dict[str, Any] = {
        "reset_id": reset_id,
        "email": email.strip().lower(),
        "user_id": user_id,
        "otp_hash": _otp_hash(otp),
        "attempt_count": 0,
        "created_at": now,
        "expires_at": now + RESET_TTL_SECONDS,
        "state": "OTP_PENDING",
        "token_jti": None,
        "claim_token": None,
        "claim_started_at": None,
    }
    ok = await redis_client.set(
        _reset_key(reset_id),
        json.dumps(payload, separators=(",", ":")),
        ex=RESET_TTL_SECONDS,
        nx=True,
    )
    if not ok:
        raise RedisStateError("Unable to create a password-reset session.")
    return payload


async def delete_password_reset(reset_id: str) -> bool:
    return bool(await redis_client.delete(_reset_key(reset_id)))


_VERIFY_RESET_OTP_SCRIPT = """
local key = KEYS[1]
local expected = ARGV[1]
local jti = ARGV[2]
local max_attempts = tonumber(ARGV[3])
local raw = redis.call('GET', key)
if not raw then return cjson.encode({status='MISSING'}) end
local data = cjson.decode(raw)
if data.state == 'LOCKED' then return cjson.encode({status='LOCKED'}) end
if data.state == 'COMPLETED' then return cjson.encode({status='COMPLETED'}) end
if data.state == 'CLAIMED' then return cjson.encode({status='IN_PROGRESS'}) end
if data.otp_hash ~= expected then
  data.attempt_count = (tonumber(data.attempt_count) or 0) + 1
  if data.attempt_count >= max_attempts then
    data.state = 'LOCKED'
    local ttl = redis.call('TTL', key)
    redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
    return cjson.encode({status='LOCKED'})
  end
  local ttl = redis.call('TTL', key)
  redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
  return cjson.encode({status='INVALID', attempts=data.attempt_count})
end
if data.state == 'TOKEN_ISSUED' then
  return cjson.encode({status='ISSUED', payload=data})
end
if data.state ~= 'OTP_PENDING' then
  return cjson.encode({status='INVALID_STATE'})
end
data.state = 'TOKEN_ISSUED'
data.token_jti = jti
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return cjson.encode({status='ISSUED', payload=data})
"""


async def verify_password_reset_otp(
    reset_id: str,
    otp: str,
    *,
    proposed_jti: str,
) -> dict[str, Any]:
    raw = await redis_client.eval(
        _VERIFY_RESET_OTP_SCRIPT,
        1,
        _reset_key(reset_id),
        _otp_hash(otp),
        proposed_jti,
        MAX_OTP_ATTEMPTS,
    )
    return _decode_script_result(raw, label="password reset OTP verification")


_CLAIM_RESET_SCRIPT = """
local key = KEYS[1]
local expected_jti = ARGV[1]
local claim = ARGV[2]
local now = tonumber(ARGV[3])
local claim_timeout = tonumber(ARGV[4])
local raw = redis.call('GET', key)
if not raw then return cjson.encode({status='MISSING'}) end
local data = cjson.decode(raw)
if data.state == 'COMPLETED' then return cjson.encode({status='COMPLETED'}) end
if data.state == 'CLAIMED' then
  local started = tonumber(data.claim_started_at) or now
  if now - started < claim_timeout then
    return cjson.encode({status='IN_PROGRESS'})
  end
  data.state = 'TOKEN_ISSUED'
  data.claim_token = cjson.null
  data.claim_started_at = cjson.null
end
if data.state ~= 'TOKEN_ISSUED' or data.token_jti ~= expected_jti then
  return cjson.encode({status='INVALID'})
end
data.state = 'CLAIMED'
data.claim_token = claim
data.claim_started_at = now
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return cjson.encode({status='CLAIMED', payload=data})
"""


async def claim_password_reset(reset_id: str, jti: str) -> dict[str, Any]:
    claim_token = secrets.token_urlsafe(32)
    raw = await redis_client.eval(
        _CLAIM_RESET_SCRIPT,
        1,
        _reset_key(reset_id),
        jti,
        claim_token,
        _utc_timestamp(),
        CLAIM_TIMEOUT_SECONDS,
    )
    result = _decode_script_result(raw, label="password reset claim")
    if result["status"] == "CLAIMED":
        result["claim_token"] = claim_token
    return result


_RELEASE_RESET_SCRIPT = """
local key = KEYS[1]
local claim = ARGV[1]
local raw = redis.call('GET', key)
if not raw then return 0 end
local data = cjson.decode(raw)
if data.state ~= 'CLAIMED' or data.claim_token ~= claim then return 0 end
data.state = 'TOKEN_ISSUED'
data.claim_token = cjson.null
data.claim_started_at = cjson.null
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return 1
"""


async def release_password_reset_claim(
    reset_id: str,
    claim_token: str,
) -> bool:
    return bool(
        await redis_client.eval(
            _RELEASE_RESET_SCRIPT,
            1,
            _reset_key(reset_id),
            claim_token,
        )
    )


_COMPLETE_RESET_SCRIPT = """
local key = KEYS[1]
local claim = ARGV[1]
local raw = redis.call('GET', key)
if not raw then return 0 end
local data = cjson.decode(raw)
if data.state == 'COMPLETED' then return 1 end
if data.state ~= 'CLAIMED' or data.claim_token ~= claim then return 0 end
data.state = 'COMPLETED'
data.claim_token = cjson.null
data.claim_started_at = cjson.null
data.otp_hash = cjson.null
local ttl = redis.call('TTL', key)
redis.call('SET', key, cjson.encode(data), 'EX', math.max(ttl, 1))
return 1
"""


async def complete_password_reset(
    reset_id: str,
    claim_token: str,
) -> bool:
    return bool(
        await redis_client.eval(
            _COMPLETE_RESET_SCRIPT,
            1,
            _reset_key(reset_id),
            claim_token,
        )
    )


_CANCEL_RESET_SCRIPT = """
local key = KEYS[1]
local raw = redis.call('GET', key)
if not raw then return cjson.encode({status='MISSING'}) end
local data = cjson.decode(raw)
if data.state == 'CLAIMED' then return cjson.encode({status='IN_PROGRESS'}) end
if data.state == 'COMPLETED' then return cjson.encode({status='COMPLETED'}) end
redis.call('DEL', key)
return cjson.encode({status='CANCELLED'})
"""


async def cancel_password_reset(reset_id: str) -> dict[str, Any]:
    raw = await redis_client.eval(
        _CANCEL_RESET_SCRIPT,
        1,
        _reset_key(reset_id),
    )
    return _decode_script_result(raw, label="password reset cancellation")


async def get_password_reset_status(
    reset_id: str,
) -> Optional[dict[str, Any]]:
    data = _decode_object(
        await redis_client.get(_reset_key(reset_id)),
        label="password reset",
    )
    if data is None:
        return None
    return {
        "reset_id": reset_id,
        "email": data["email"],
        "state": str(data.get("state") or "OTP_PENDING"),
        "expires_in_seconds": max(
            int(await redis_client.ttl(_reset_key(reset_id))), 0
        ),
        "attempts_remaining": max(
            MAX_OTP_ATTEMPTS - int(data.get("attempt_count") or 0), 0
        ),
    }
