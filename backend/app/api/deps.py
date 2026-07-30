from __future__ import annotations

from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.jwt import decode_access_token
from app.db.database import get_db
from app.models.user import User

security = HTTPBearer(auto_error=True)
UserRole = Literal["STUDENT", "TEACHER"]


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("id")
        email = payload.get("sub")
        token_version = payload.get("token_version")
        if not user_id or not email or token_version is None:
            raise credentials_exception()
        parsed_version = int(token_version)
        if parsed_version < 0:
            raise ValueError("Negative token version")
    except (JWTError, TypeError, ValueError) as exc:
        raise credentials_exception() from exc

    result = await db.execute(select(User).where(User.id == str(user_id)))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception()
    if user.email != str(email).strip().lower():
        raise credentials_exception()
    if int(user.token_version or 0) != parsed_version:
        raise credentials_exception()
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified.",
        )
    return user


async def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student account required.",
        )
    return current_user


async def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher account required.",
        )
    return current_user


def require_role(user: User, role: UserRole) -> None:
    if user.role != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role.title()} account required.",
        )
