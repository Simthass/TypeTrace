
from typing import Any, Dict, Optional

from fastapi import Request

from app.models.audit import AuditLog


def create_audit_log(
    *,
    event_type: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    request: Optional[Request] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Build an append-only audit row without coupling route logic to model fields."""

    return AuditLog(
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        request_id=request.headers.get("x-request-id") if request else None,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        event_metadata=metadata or {},
    )
