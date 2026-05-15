import os
import joblib
import numpy as np
import warnings
import json
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from app.ml.train_model import extract_features_from_keystroke_array, FEATURE_COLUMNS

# Ignore scikit-learn version warnings in the terminal
warnings.filterwarnings("ignore", category=UserWarning)

# ─── 1. DATABASE SETUP ────────────────────────────────────────────────────────
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

if DB_URL and "+asyncpg" in DB_URL:
    DB_URL = DB_URL.replace("+asyncpg", "")

try:
    engine = create_engine(DB_URL)
    print("🗄️ Database engine initialized.")
except Exception as e:
    print(f"❌ Database connection failed. Check your .env file. Error: {e}")
    engine = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# ─── 2. LOAD THE ML MODEL AT STARTUP ──────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "typetrace_rf_model.joblib")

try:
    rf_model = joblib.load(MODEL_PATH)
    print("🧠 TypeTrace AI Model loaded successfully into memory!")
except Exception as e:
    print(f"⚠️ Warning: ML Model not found. Did you run train_model.py? Error: {e}")
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
    user_id: str = "student" 

# ─── 4. THE ANALYSIS ENDPOINT ─────────────────────────────────────────────────
@app.post("/api/v1/sessions/analyze")
async def analyze_session(data: KeystrokeSession):
    
    classification_result = None
    confidence_score = None

    # 1. EXTRACT ADVANCED FEATURES USING PYTHON (Not React)
    # This guarantees the live inference perfectly matches the training data math
    extracted_features = extract_features_from_keystroke_array(
        raw_array=data.keystroke_array,
        total_keystrokes=len([k for k in data.keystroke_array if k.get("type") == "keydown"]),
        deletions=data.stats.deletions,
        pauses=data.stats.pauses,
        duration_seconds=data.stats.sessionSeconds,
        text_length=len(data.text_content)
    )

    # 2. DETERMINISTIC KILL SWITCH (Heuristics)
    # Using the new true Net WPM and Burst Ratios
    if extracted_features["net_wpm"] > 180 or extracted_features["paste_event_count"] > 0:
        classification_result = "AI-GENERATED"
        confidence_score = 99.9
        print(f"🚨 KILL SWITCH: Blocked. Net WPM: {extracted_features['net_wpm']}, Pastes: {extracted_features['paste_event_count']}")

    elif extracted_features["burst_ratio"] > 0.4:
        # If more than 40% of keys are typed in under 50ms, it's a script.
        classification_result = "AI-GENERATED"
        confidence_score = 99.9
        print(f"🚨 KILL SWITCH: Mechanical Burst Ratio detected ({extracted_features['burst_ratio']})")

    # 3. PROBABILISTIC ML ENGINE
    elif rf_model:
        # Format the features into the exact 9-column array the new model expects
        features_matrix = np.array([[extracted_features[col] for col in FEATURE_COLUMNS]])

        probabilities = rf_model.predict_proba(features_matrix)[0]
        classes = rf_model.classes_  
        prediction_index = np.argmax(probabilities)
        
        classification_result = classes[prediction_index]
        confidence_score = round(probabilities[prediction_index] * 100, 2)
        print(f"📊 ML Prediction: {classification_result} ({confidence_score}%)")
    else:
        raise HTTPException(status_code=500, detail="ML Model not loaded into memory.")

    # 4. DATABASE SAVE (Unchanged)
    if engine:
        try:
            with engine.begin() as conn:
                final_user_id = data.user_id
                if final_user_id == "student":
                    user_record = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
                    if user_record:
                        final_user_id = user_record[0]
                    else:
                        raise ValueError("No users found in DB!")

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
                    "wpm": extracted_features["net_wpm"], # Saving the true Net WPM
                    "total_keystrokes": len(data.keystroke_array),
                    "deletions": data.stats.deletions,
                    "pauses": data.stats.pauses,
                    "avg_iki": extracted_features["iki_mean"],
                    "duration_seconds": data.stats.sessionSeconds,
                    "classification_result": classification_result,
                    "ml_confidence_score": float(confidence_score),
                    "raw_keystroke_data": json.dumps(data.keystroke_array) 
                })
        except Exception as e:
            print(f"⚠️ Database Save Error: {e}")

    return {
        "status": "success",
        "message": "Session analyzed.",
        "ml_result": {
            "classification": classification_result,
            "confidence_score": confidence_score,
            "advanced_stats": extracted_features # Send back to React to display on the modal!
        }
    }

# ─── 5. FETCH HISTORY ENDPOINT ────────────────────────────────────────────────
@app.get("/api/v1/sessions/history/{user_id}")
async def get_session_history(user_id: str):
    if not engine:
        raise HTTPException(status_code=500, detail="Database not connected.")
        
    try:
        with engine.connect() as conn:
            final_user_id = user_id
            if user_id == "student":
                user_record = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
                if user_record:
                    final_user_id = user_record[0]
                else:
                    return {"sessions": []}

            query = text("""
                SELECT id, title, wpm, duration_seconds, classification_result, ml_confidence_score, created_at 
                FROM typing_sessions 
                WHERE user_id = :user_id 
                ORDER BY created_at DESC
            """)
            
            result = conn.execute(query, {"user_id": final_user_id})
            
            sessions = []
            for row in result:
                sessions.append({
                    "id": row.id,
                    "title": row.title,
                    "wpm": round(row.wpm, 1),
                    "duration": round(row.duration_seconds, 1),
                    "classification": row.classification_result,
                    "confidence": row.ml_confidence_score,
                    "date": row.created_at.strftime("%b %d, %Y - %I:%M %p") if row.created_at else "Unknown Date"
                })
                
            return {"status": "success", "sessions": sessions}
            
    except Exception as e:
        print(f"⚠️ Fetch History Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history.")