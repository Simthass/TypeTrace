import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

# 1. Load the database URL securely from the .env file
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

# Dynamically get the exact folder path where this script lives (TypeTrace/backend/ml)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def fetch_manual_sessions():
    """Extracts your personal React sessions directly from PostgreSQL."""
    print("Fetching personal calibration data from PostgreSQL...")
    if not DB_URL:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return pd.DataFrame()
        
    try:
        # Pandas needs a synchronous driver! We convert asyncpg to standard postgresql
        sync_db_url = DB_URL.replace("+asyncpg", "")
        
        engine = create_engine(sync_db_url)
        query = """
            SELECT wpm, deletions, pauses, avg_iki, duration_seconds as session_seconds, 'HUMAN' as label 
            FROM typing_sessions 
            WHERE total_keystrokes > 50
        """
        df = pd.read_sql(query, engine)
        print(f"✅ Successfully loaded {len(df)} manual sessions from your database.")
        return df
    except Exception as e:
        print(f"❌ Database connection failed. Error: {e}")
        return pd.DataFrame()

def load_and_prepare_data(db_df):
    """Merges all data sources together"""
    print("\nMerging datasets...")
    
    # Safely build the path to your synthetic data folder
    synthetic_path = os.path.join(BASE_DIR, "data", "synthetic_attacks.csv")
    
    try:
        synthetic_df = pd.read_csv(synthetic_path)
    except FileNotFoundError:
        print(f"❌ Error: Cannot find {synthetic_path}. Did you run generate_synthetic_data.py?")
        return pd.DataFrame()
    
    # Add Gaussian Noise to your DB data to simulate organic human variance
    augmented_human_data = []
    if len(db_df) > 0:
        for _ in range(3000): 
            sample = db_df.sample(1).iloc[0].copy()
            sample['wpm'] = max(10, sample['wpm'] + np.random.normal(0, 5))
            sample['avg_iki'] = max(50, sample['avg_iki'] + np.random.normal(0, 20))
            sample['deletions'] = max(0, int(sample['deletions'] + np.random.normal(0, 2)))
            augmented_human_data.append(sample)
    
    human_df = pd.DataFrame(augmented_human_data)
    
    # Combine it all
    final_df = pd.concat([synthetic_df, human_df], ignore_index=True)
    final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)
    return final_df

def train_random_forest():
    print("--- STARTING TYPETRACE AI TRAINING PIPELINE ---\n")
    
    db_df = fetch_manual_sessions()
    
    df = load_and_prepare_data(db_df)
    
    if df.empty:
        print("❌ Cannot train model without data. Exiting.")
        return

    print("\nPreparing features for Random Forest...")
    X = df[['wpm', 'deletions', 'pauses', 'avg_iki', 'session_seconds']]
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier... (Teaching the AI)")
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, class_weight='balanced')
    rf_model.fit(X_train, y_train)
    
    print("\n--- Model Evaluation ---")
    y_pred = rf_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Overall Accuracy: {accuracy * 100:.2f}%\n")
    
    # Save the file into the exact ml folder securely
    model_path = os.path.join(BASE_DIR, "typetrace_rf_model.joblib")
    joblib.dump(rf_model, model_path)
    print(f"✅ Success! The 'Brain' has been saved to {model_path}.")

if __name__ == "__main__":
    train_random_forest()