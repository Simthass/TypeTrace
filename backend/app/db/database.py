# backend/app/db/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

# Explicitly load the .env file from the backend folder
# honestly i always forget this line and spend 20 minutes wondering why my db won't connect.
load_dotenv()

# We use the environment variable, but the fallback now matches our Docker setup
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://typetrace_admin:secure_password_123@localhost:5432/typetracedb"
)

# echo=False in production so we dont leak sql queries to the terminal
engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=False)

# creating the session factory
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    """
    Dependency injection for FastAPI. Creates a new database session 
    for each request and closes it safely after.
    """
    async with AsyncSessionLocal() as session:
        yield session