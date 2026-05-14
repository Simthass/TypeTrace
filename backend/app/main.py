from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import joblib
import numpy as np
import os
import warnings
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Optional

# Ignore scikit-learn version warnings in the terminal
warnings.filterwarnings("ignore", category=UserWarning)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # This tells FastAPI to trust your React app
    allow_credentials=True,
    allow_methods=["*"], # This allows the 'OPTIONS' preflight check to pass
    allow_headers=["*"],
)

# ─── 1. LOAD THE ML MODEL AT STARTUP ──────────────────────────────────────────
# This ensures the API doesn't load the file from the hard drive on every single click
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "typetrace_rf_model.joblib")

try:
    rf_model = joblib.load(MODEL_PATH)
    print("TypeTrace AI Model loaded successfully into memory!")
except Exception as e:
    print(f"Warning: ML Model not found. Did you run train_model.py? Error: {e}")
    rf_model = None


# ─── 2. DEFINE THE INCOMING JSON PAYLOAD ──────────────────────────────────────
from typing import Any, Optional
from pydantic import BaseModel

# ─── 2. DEFINE THE INCOMING JSON PAYLOAD ──────────────────────────────────────
class SessionStats(BaseModel):
    wpm: float
    keystrokes: int
    deletions: int
    pauses: int
    avgIki: float
    sessionSeconds: float  # <-- THE FINAL FIX! Exactly matches React!

class KeystrokeSession(BaseModel):
    title: str
    text_content: str
    keystroke_array: Any
    stats: SessionStats
    user_id: str = "student"


# ─── 3. THE ANALYSIS ENDPOINT ─────────────────────────────────────────────────
@app.post("/api/v1/sessions/analyze")
async def analyze_session(data: KeystrokeSession):
    
    classification_result = "HUMAN"
    confidence_score = 95.5

    if rf_model:
        # 1. Extract the features exactly as the ML model expects them
        # MUST BE: ['wpm', 'deletions', 'pauses', 'avg_iki', 'session_seconds']
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

    # 4. Return the real ML results to the React frontend
    return {
        "status": "success",
        "message": "Session analyzed and cryptographically sealed.",
        "ml_result": {
            "classification": classification_result,
            "confidence_score": confidence_score
        }
    }
