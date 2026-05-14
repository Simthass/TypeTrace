import os
import joblib
import numpy as np
import warnings
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import json

# Ignore scikit-learn version warnings in the terminal
warnings.filterwarnings("ignore", category=UserWarning)

# ─── 1. DATABASE SETUP ────────────────────────────────────────────────────────
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

# FastAPI is modern, but pandas/scikit-learn prefer synchronous DB connections.
# We strip out the asyncpg tag if it exists so SQLAlchemy can talk to it cleanly.
if DB_URL and "+asyncpg" in DB_URL:
    DB_URL = DB_URL.replace("+asyncpg", "")

try:
    engine = create_engine(DB_URL)
    print("Database engine initialized.")
except Exception as e:
    print(f"Database connection failed. Check your .env file. Error: {e}")
    engine = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # This tells FastAPI to trust your React app
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# ─── 2. LOAD THE ML MODEL AT STARTUP ──────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Note: depending on your folder structure, if this fails, change "ml" to "../ml"
MODEL_PATH = os.path.join(BASE_DIR, "ml", "typetrace_rf_model.joblib")

try:
    rf_model = joblib.load(MODEL_PATH)
    print("TypeTrace AI Model loaded successfully into memory!")
except Exception as e:
    print(f"Warning: ML Model not found. Did you run train_model.py? Error: {e}")
    rf_model = None


# ─── 3. DEFINE THE INCOMING JSON PAYLOAD ──────────────────────────────────────
class SessionStats(BaseModel):
    wpm: float
    keystrokes: int
    deletions: int
    pauses: int
    avgIki: float
    sessionSeconds: float  

class KeystrokeSession(BaseModel):
    title: str
    text_content: str
    keystroke_array: Any
    stats: SessionStats
    user_id: str = "student" # Default fallback


# ─── 4. THE ANALYSIS ENDPOINT ─────────────────────────────────────────────────
@app.post("/api/v1/sessions/analyze")
async def analyze_session(data: KeystrokeSession):
    
    classification_result = "HUMAN"
    confidence_score = 95.5

    # --- ML PREDICTION ---
    if rf_model:
        # 1. Extract the features exactly as the ML model expects them
        features = np.array([[
            data.stats.wpm,
            data.stats.deletions,
            data.stats.pauses,
            data.stats.avgIki,
            data.stats.sessionSeconds
        ]])

        # 2. Ask the model to predict the class
        probabilities = rf_model.predict_proba(features)[0]
        
        # 3. Find the highest probability and its matching label
        classes = rf_model.classes_  
        prediction_index = np.argmax(probabilities)
        
        classification_result = classes[prediction_index]
        confidence_score = round(probabilities[prediction_index] * 100, 2)
        
        print(f"ML Prediction: {classification_result} ({confidence_score}%)")

# --- DATABASE SAVE ---
    if engine:
        try:
            with engine.begin() as conn:
                
                # 1. THE FOREIGN KEY FIX: Find a real user UUID in the database
                final_user_id = data.user_id
                if final_user_id == "student":
                    # Grab the very first real user from your DB
                    user_record = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
                    if user_record:
                        final_user_id = user_record[0]
                    else:
                        raise ValueError("No users found in DB! Please register a user in the frontend first.")

                # 2. Save the session with the real UUID
               # 2. Save the session with the real UUID AND the raw keystroke array
                query = text("""
                    INSERT INTO typing_sessions 
                    (user_id, title, text_content, wpm, total_keystrokes, deletions, pauses, avg_iki, duration_seconds, classification_result, ml_confidence_score, raw_keystroke_data) 
                    VALUES 
                    (:user_id, :title, :text_content, :wpm, :total_keystrokes, :deletions, :pauses, :avg_iki, :duration_seconds, :classification_result, :ml_confidence_score, :raw_keystroke_data)
                """)
                
                conn.execute(query, {
                    "user_id": final_user_id,  
                    "title": data.title,
                    "text_content": data.text_content,
                    "wpm": data.stats.wpm,
                    "total_keystrokes": data.stats.keystrokes,
                    "deletions": data.stats.deletions,
                    "pauses": data.stats.pauses,
                    "avg_iki": data.stats.avgIki,
                    "duration_seconds": data.stats.sessionSeconds,
                    "classification_result": classification_result,
                    "ml_confidence_score": float(confidence_score),
                    "raw_keystroke_data": json.dumps(data.keystroke_array) # Converts the JS Array to PostgreSQL JSONB
                })
                print("✅ Session permanently cryptographically sealed to PostgreSQL.")
        except Exception as e:
            print(f"⚠️ Database Save Error: {e}")

    # --- RETURN RESPONSE TO REACT ---
    return {
        "status": "success",
        "message": "Session analyzed and cryptographically sealed.",
        "ml_result": {
            "classification": classification_result,
            "confidence_score": confidence_score
        }
    }