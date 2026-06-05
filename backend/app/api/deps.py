# backend/app/api/deps.py

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
    """
    Returns the authenticated database user from the JWT bearer token.
    """

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        email = payload.get("sub")

        if not email:
            raise credentials_exception()

    except JWTError:
        raise credentials_exception()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception()

    return user


async def require_student(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Allows only student users.
    """

    if current_user.role != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student account required.",
        )

    return current_user


async def require_teacher(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Allows only teacher users.
    """

    if current_user.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher account required.",
        )

    return current_user


def require_role(user: User, role: UserRole) -> None:
    """
    Utility role checker for service-layer logic.
    """

    if user.role != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role.title()} account required.",
        )