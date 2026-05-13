# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# bruh i forgot to import the sessions router here last time, no wonder it 404'd
from app.api.routes import auth, sessions 
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

# Registering the routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
# linking the new sessions endpoint so the frontend can actually reach it
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"]) 

@app.get("/")
async def root():
    return {"message": "TypeTrace API is running secure and stateless."}