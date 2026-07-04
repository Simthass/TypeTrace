"""Generate a local Ed25519 keypair for TypeTrace certificate signing.

Usage:
    python backend/scripts/generate_signing_key.py

Copy the printed values into your local .env. Never commit the private key.
"""

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, PublicFormat, NoEncryption
import base64
import secrets


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


private_key = Ed25519PrivateKey.generate()
private_raw = private_key.private_bytes(
    encoding=Encoding.Raw,
    format=PrivateFormat.Raw,
    encryption_algorithm=NoEncryption(),
)
public_raw = private_key.public_key().public_bytes(
    encoding=Encoding.Raw,
    format=PublicFormat.Raw,
)
key_id = f"typetrace-ed25519-{secrets.token_hex(4)}"

print("CERTIFICATE_SIGNING_KEY_ID=" + key_id)
print("CERTIFICATE_SIGNING_PRIVATE_KEY=" + b64url(private_raw))
print("CERTIFICATE_SIGNING_PUBLIC_KEY=" + b64url(public_raw))
print("CERTIFICATE_ALLOW_HMAC_FALLBACK=false")
