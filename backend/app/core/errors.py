from __future__ import annotations

from typing import Any, Mapping, Optional

from fastapi import HTTPException
from pydantic import BaseModel


class ApiError(HTTPException):
    """HTTP error with a stable machine-readable code and structured details.

    Standard ``HTTPException`` remains available for simple string failures.
    Use this class only when a client must consume a structured error contract.
    """

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> None:
        super().__init__(
            status_code=status_code,
            detail=message,
            headers=dict(headers) if headers else None,
        )
        self.code = code
        self.message = message
        self.details = self._serialize_details(details)

    @staticmethod
    def _serialize_details(value: Any) -> Any:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        return value
