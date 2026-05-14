import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import warnings

warnings.filterwarnings("ignore")

# 1. Load the database URL securely from the .env file
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def fetch_manual_sessions():
    """Extracts your personal React sessions directly from PostgreSQL."""
    print("Fetching personal calibration data from PostgreSQL...")
    if not DB_URL:
        return pd.DataFrame()
        
    try:
        sync_db_url = DB_URL.replace("+asyncpg", "")
        engine = create_engine(sync_db_url)
        query = """
            SELECT wpm, deletions, pauses, avg_iki, duration_seconds as session_seconds, 'HUMAN' as label 
            FROM typing_sessions 
            WHERE total_keystrokes > 50
        """
        df = pd.read_sql(query, engine)
        print(f"Successfully loaded {len(df)} manual sessions from your database.")
        return df
    except Exception as e:
        print(f"Database connection failed. Error: {e}")
        return pd.DataFrame()

def process_csv_to_session(file_path, filename):
    """Converts raw VK/HT/FT events into our 5 Session-level variables."""
    try:
        df = pd.read_csv(file_path)
        if df.empty or 'FT' not in df.columns or 'VK' not in df.columns:
            return None
        
        # Filter out the initial -1 FT (the very first keystroke has no flight time)
        valid_ft = df[df['FT'] > 0]['FT']
        
        # 1. Deletions (VK 8 is the Backspace key)
        deletions = len(df[df['VK'] == 8])
        
        # 2. Pauses (Flight times longer than 1000ms)
        pauses = len(valid_ft[valid_ft > 1000])
        
        # 3. Average IKI
        avg_iki = valid_ft.mean() if not valid_ft.empty else 0
        
        # 4. Total Keystrokes & WPM
        total_keystrokes = len(df)
        total_time_ms = df['HT'].sum() + valid_ft.sum()
        session_seconds = total_time_ms / 1000.0
        
        if session_seconds > 0:
            wpm = (total_keystrokes / 5.0) / (session_seconds / 60.0)
        else:
            wpm = 0
            
        # 5. Determine Label from filename
        label = 'HUMAN' if 'HUMAN' in filename.upper() else 'AI-GENERATED'
        
        return {
            'wpm': wpm,
            'deletions': deletions,
            'pauses': pauses,
            'avg_iki': avg_iki,
            'session_seconds': session_seconds,
            'label': label
        }
    except Exception:
        return None

def crawl_massive_dataset(dataset_path="D:/DATASET", max_files=5000):
    """The Spider that crawls your 3.2GB Kaggle folder safely."""
    print(f"\nUnleashing the crawler on {dataset_path}...")
    session_data = []
    files_processed = 0
    
    if not os.path.exists(dataset_path):
        print(f"Error: Cannot find dataset folder at {dataset_path}")
        return pd.DataFrame()
        
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if file.endswith('.csv'):
                if files_processed >= max_files:
                    break
                    
                file_path = os.path.join(root, file)
                session_stats = process_csv_to_session(file_path, file)
                
                if session_stats:
                    session_data.append(session_stats)
                    files_processed += 1
                    
                    if files_processed % 1000 == 0:
                        print(f"   ... digested {files_processed} files ...")
                        
        if files_processed >= max_files:
            break
            
    df = pd.DataFrame(session_data)
    print(f"Extracted {len(df)} complete sessions from the Kaggle dataset.")
    return df

def load_and_prepare_data(db_df):
    """Merges your database data with the massive Kaggle dataset."""
    
    # 1. Crawl the D:/DATASET folder
    kaggle_df = crawl_massive_dataset("D:/DATASET", max_files=5000)
    
    # 2. Add slight variance to your manual DB data to balance the massive dataset
    augmented_human_data = []
    if len(db_df) > 0:
        for _ in range(500): 
            sample = db_df.sample(1).iloc[0].copy()
            sample['wpm'] = max(10, sample['wpm'] + np.random.normal(0, 5))
            sample['avg_iki'] = max(50, sample['avg_iki'] + np.random.normal(0, 20))
            sample['deletions'] = max(0, int(sample['deletions'] + np.random.normal(0, 2)))
            augmented_human_data.append(sample)
    
    human_df = pd.DataFrame(augmented_human_data)
    
    # Combine everything
    final_df = pd.concat([kaggle_df, human_df], ignore_index=True)
    final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)
    return final_df

def train_random_forest():
    print("--- STARTING TYPETRACE AI TRAINING PIPELINE ---\n")
    
    db_df = fetch_manual_sessions()
    df = load_and_prepare_data(db_df)
    
    if df.empty:
        print("Cannot train model without data. Exiting.")
        return

    print("\nPreparing features for Random Forest...")
    X = df[['wpm', 'deletions', 'pauses', 'avg_iki', 'session_seconds']]
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier... (Teaching the AI with 100 Decision Trees)")
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, class_weight='balanced')
    rf_model.fit(X_train, y_train)
    
    print("\n--- Model Evaluation ---")
    y_pred = rf_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Overall Accuracy: {accuracy * 100:.2f}%\n")
    
    print("--- Feature Importance (What the AI cares about most) ---")
    importances = rf_model.feature_importances_
    for feature, imp in zip(X.columns, importances):
        print(f"{feature}: {imp * 100:.2f}%")
    
    # Save the master brain
    model_path = os.path.join(BASE_DIR, "typetrace_rf_model.joblib")
    joblib.dump(rf_model, model_path)
    print(f"\nSuccess! The final 'Brain' has been saved to {model_path}.")

if __name__ == "__main__":
    train_random_forest()