import base64
import json
import logging
from typing import Any, Optional

from cryptography.fernet import Fernet
from app.core.config import settings

logger = logging.getLogger("typetrace.crypto")

# In production, ENCRYPTION_MASTER_KEY must be a valid 32-byte url-safe base64 string.
# We fallback to a dummy key to prevent local dev environments from crashing.
_key_str = getattr(settings, "ENCRYPTION_MASTER_KEY", None)
if not _key_str:
    _key = base64.urlsafe_b64encode(b"0" * 32)
else:
    _key = _key_str.encode("utf-8") if isinstance(_key_str, str) else _key_str

try:
    _cipher = Fernet(_key)
except Exception as exc:
    logger.error("Failed to initialize Fernet cipher. Check ENCRYPTION_MASTER_KEY. %s", exc)
    _cipher = None


def encrypt_text(text: Optional[str]) -> Optional[str]:
    if not text or _cipher is None:
        return text
    return _cipher.encrypt(text.encode("utf-8")).decode("utf-8")


def decrypt_text(token: Optional[str]) -> Optional[str]:
    if not token or _cipher is None:
        return token
    try:
        return _cipher.decrypt(token.encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback: if decryption fails, assume it's legacy unencrypted plaintext
        return token


def encrypt_json(data: Optional[Any]) -> Optional[Any]:
    if not data or _cipher is None:
        return data
    json_str = json.dumps(data)
    return _cipher.encrypt(json_str.encode("utf-8")).decode("utf-8")


def decrypt_json(token: Optional[Any]) -> Optional[Any]:
    if not token or _cipher is None:
        return token
    
    # If it's already a dict/list, it's unencrypted data pulled by ORM/JSONB
    if isinstance(token, (dict, list)):
        return token
        
    try:
        decrypted_str = _cipher.decrypt(token.encode("utf-8")).decode("utf-8")
        return json.loads(decrypted_str)
    except Exception:
        # Fallback: attempting to parse legacy plaintext JSON string
        try:
            return json.loads(token)
        except (json.JSONDecodeError, TypeError):
            return token