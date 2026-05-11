# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.routes import auth
from app.db.database import engine, Base

# setting up basic logging so we can see what happens in the terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# initializing the FastAPI app with meta info for the OpenAPI docs
app = FastAPI(
    title="TypeTrace API",
    description="Behavioral Keystroke Authentication System",
    version="1.0.0"
)

# STRICT SECURITY: CORS (Cross-Origin Resource Sharing)
# We only allow our specific frontend to talk to this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to create database tables
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up TypeTrace Backend...")
    # This creates the tables in postgres based on our models.
    # In a real enterprise app we use Alembic for migrations, but this is 
    # perfect for getting the dissertation prototype running immediately.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified.")

# Registering the router we built earlier
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

@app.get("/")
async def root():
    return {"message": "TypeTrace API is running secure and stateless."}