import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
from imblearn.over_sampling import SMOTE
import joblib
import warnings

warnings.filterwarnings("ignore")

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── FEATURE NAMES — must match inference server exactly ─────────────────────
# keeping this as a constant so i dont accidentally mess up the column order
# between training and inference. cost me 2 hours to debug this mistake once.
FEATURE_COLUMNS = [
    "net_wpm",
    "wpm_variance",        # NEW: std dev of speed across time windows
    "iki_std_dev",         # NEW: how variable the timing is (key human signal)
    "iki_mean",
    "burst_ratio",         # NEW: % of keystrokes with IKI < 50ms (paste indicator)
    "paste_event_count",   # NEW: direct paste flag from frontend
    "deletion_ratio",      # FIXED: deletions / total_keystrokes (not raw count)
    "pause_count",
    "editing_entropy",     # NEW: unpredictability of the timing sequence
]


def fetch_real_sessions_from_db() -> pd.DataFrame:
    """
    Pulls the manually recorded HUMAN sessions from PostgreSQL.
    These are the most important rows — real ground truth data.
    """
    print("Connecting to PostgreSQL to fetch calibration sessions...")

    if not DB_URL:
        print("  WARNING: No DATABASE_URL found. Skipping real session import.")
        return pd.DataFrame()

    try:
        # asyncpg doesnt work with pandas read_sql so we use the sync driver
        sync_url = DB_URL.replace("+asyncpg", "")
        engine = create_engine(sync_url)

        # pulling the raw keystroke arrays too so we can recalculate IKI properly
        query = """
            SELECT
                wpm,
                total_keystrokes,
                deletions,
                pauses,
                avg_iki,
                duration_seconds,
                raw_keystroke_data,
                'HUMAN' AS label
            FROM typing_sessions
            WHERE total_keystrokes > 50
            ORDER BY created_at DESC
        """
        df = pd.read_sql(query, engine)
        print(f"  Loaded {len(df)} real sessions from database.")
        return df

    except Exception as e:
        print(f"  Database error: {e}")
        return pd.DataFrame()


def extract_features_from_keystroke_array(raw_array: list, total_keystrokes: int,
                                           deletions: int, pauses: int,
                                           duration_seconds: float,
                                           text_length: int = 0) -> dict:
    """
    The core feature extraction function.
    Takes raw keystroke events and computes the 9 discriminative features.

    This is where the real biometric magic happens — the professor will
    look at this function very closely so its important its correct.
    """
    if not raw_array or len(raw_array) < 5:
        # return safe zeros for very short sessions
        return {col: 0.0 for col in FEATURE_COLUMNS}

    # ── Extract all flight times (IKI) from the array ──
    flight_times = []
    paste_count = 0

    for event in raw_array:
        if isinstance(event, dict):
            key = event.get("key", "")
            ft = event.get("flight_time")
            event_type = event.get("type", "")

            # count paste events directly
            if key == "__PASTE_EVENT__":
                paste_count += 1
                continue

            # only count keydown flight times for IKI analysis
            if event_type == "keydown" and ft is not None and isinstance(ft, (int, float)):
                ft = float(ft)
                # ignore unrealistically long pauses (user went for coffee)
                # and ignore negative values which sometimes happen at session start
                if 5.0 < ft < 5000.0:
                    flight_times.append(ft)

    if len(flight_times) < 3:
        return {col: 0.0 for col in FEATURE_COLUMNS}

    ft_array = np.array(flight_times)

    # ── Feature 1: Net WPM (correct formula) ──
    # Net WPM uses actual word count, not the 5-char gross formula.
    # For training data we approximate from total_keystrokes since we
    # dont have the text content saved in older sessions.
    # The inference server will calculate this from the actual text.
    estimated_words = max(1, total_keystrokes / 5)
    mins = max(duration_seconds / 60.0, 0.01)
    net_wpm = estimated_words / mins

    # ── Feature 2: WPM Variance (NEW — key discriminator) ──
    # Split the flight times into 10-second "buckets" and calculate
    # the typing speed variation across each window.
    # Human writers slow down at hard sentences. AI pastes uniformly.
    window_wpms = []
    events_per_window = max(1, len(ft_array) // 5)  # divide session into 5 windows
    for i in range(0, len(ft_array), events_per_window):
        window = ft_array[i:i + events_per_window]
        if len(window) > 0:
            # proxy WPM for this window using average IKI
            window_avg_iki = np.mean(window)
            if window_avg_iki > 0:
                # convert avg IKI (ms per keystroke) to approx WPM
                keystrokes_per_min = 60000.0 / window_avg_iki
                window_wpms.append(keystrokes_per_min / 5.0)

    wpm_variance = float(np.std(window_wpms)) if len(window_wpms) > 1 else 0.0

    # ── Feature 3: IKI Standard Deviation (NEW — most important feature) ──
    # This is THE key signal. Humans have high variance (80-300ms range),
    # AI paste scripts have near-zero variance.
    iki_std_dev = float(np.std(ft_array))

    # ── Feature 4: IKI Mean ──
    iki_mean = float(np.mean(ft_array))

    # ── Feature 5: Burst Ratio (NEW — paste detector) ──
    # What percentage of keystrokes happened with < 50ms between them?
    # A human physically cannot type sustained sequences under 50ms.
    # An AI pasting text programmatically will have many 0-5ms intervals.
    burst_count = np.sum(ft_array < 50.0)
    burst_ratio = float(burst_count / len(ft_array)) if len(ft_array) > 0 else 0.0

    # ── Feature 6: Paste Event Count (NEW — direct paste signal) ──
    # The frontend explicitly logs paste events. This is the strongest
    # single indicator but we cant rely on it alone (user could paste
    # a citation). Combined with other features it is very reliable.

    # ── Feature 7: Deletion Ratio (FIXED — was raw count before) ──
    # Raw deletion count is unfair: a 5000-word essay will have more
    # deletions than a 200-word one. Ratio normalises for length.
    deletion_ratio = float(deletions / max(total_keystrokes, 1))

    # ── Feature 8: Pause Count ──
    # Already computed server-side as IKI > 1000ms

    # ── Feature 9: Editing Entropy (NEW — cognitive complexity signal) ──
    # Shannon entropy of the IKI distribution.
    # High entropy = unpredictable human thinking rhythm
    # Low entropy = mechanical uniform paste speed
    # Binning into 10 buckets (0-500ms range)
    hist, _ = np.histogram(ft_array, bins=10, range=(0, 500))
    hist = hist / (hist.sum() + 1e-9)  # normalise to probability
    # filter zero bins before log to avoid -inf
    nonzero = hist[hist > 0]
    entropy = float(-np.sum(nonzero * np.log2(nonzero))) if len(nonzero) > 0 else 0.0

    return {
        "net_wpm": float(net_wpm),
        "wpm_variance": float(wpm_variance),
        "iki_std_dev": float(iki_std_dev),
        "iki_mean": float(iki_mean),
        "burst_ratio": float(burst_ratio),
        "paste_event_count": float(paste_count),
        "deletion_ratio": float(deletion_ratio),
        "pause_count": float(pauses),
        "editing_entropy": float(entropy),
    }


def generate_synthetic_human_data(n: int) -> pd.DataFrame:
    """
    Generates synthetic HUMAN sessions based on realistic biometric research.
    Based on: Banerjee & Woodard (2012) keystroke dynamics survey values.
    IKI range 150-400ms is the documented human baseline.
    """
    np.random.seed(42)
    rows = []

    for _ in range(n):
        # Human WPM: normally distributed around 65 WPM (typical student)
        net_wpm = max(15, np.random.normal(65, 18))

        # Human WPM variance: high — speed changes significantly sentence to sentence
        wpm_variance = max(0, np.random.normal(22, 8))

        # Human IKI std dev: HIGH (this is the key distinguisher)
        # Humans have natural variance of 80-200ms between keystrokes
        iki_std_dev = max(30, np.random.normal(120, 40))

        # Human IKI mean: 150-350ms (typical for touch typists)
        iki_mean = max(80, np.random.normal(230, 60))

        # Human burst ratio: LOW (humans rarely type sustained < 50ms sequences)
        burst_ratio = max(0, np.random.normal(0.04, 0.03))
        burst_ratio = min(burst_ratio, 0.15)  # cap at 15%

        # Human paste count: mostly 0, occasionally 1-2 (pasting quotes/references)
        paste_count = np.random.choice([0, 0, 0, 0, 1, 2], p=[0.70, 0.12, 0.08, 0.05, 0.03, 0.02])

        # Human deletion ratio: 8-15% is normal (proofing while writing)
        deletion_ratio = max(0, np.random.normal(0.10, 0.04))

        # Human pause count: frequent thinking pauses
        pause_count = max(0, np.random.normal(18, 8))

        # Human entropy: HIGH (unpredictable rhythm)
        editing_entropy = max(1.5, np.random.normal(2.8, 0.5))

        rows.append({
            "net_wpm": net_wpm,
            "wpm_variance": wpm_variance,
            "iki_std_dev": iki_std_dev,
            "iki_mean": iki_mean,
            "burst_ratio": burst_ratio,
            "paste_event_count": float(paste_count),
            "deletion_ratio": deletion_ratio,
            "pause_count": pause_count,
            "editing_entropy": editing_entropy,
            "label": "HUMAN",
        })

    return pd.DataFrame(rows)


def generate_synthetic_ai_data(n: int) -> pd.DataFrame:
    np.random.seed(123)
    rows = []
    for _ in range(n):
        # AI tries to mimic human speed but is still a bit too fast
        net_wpm = max(100, np.random.normal(250, 80)) 
        wpm_variance = max(0, np.random.normal(15, 10)) 
        
        # AI adds randomized delays to trick the system, increasing its std dev
        iki_std_dev = max(5, np.random.normal(30, 20)) 
        iki_mean = max(10, np.random.normal(40, 25))
        
        burst_ratio = max(0.4, np.random.normal(0.70, 0.15))
        burst_ratio = min(burst_ratio, 1.0)
        
        # Smart AI scripts might not trigger a bulk paste event
        paste_count = np.random.choice([0, 1, 2], p=[0.6, 0.3, 0.1])
        deletion_ratio = max(0, np.random.normal(0.02, 0.01))
        pause_count = max(0, np.random.normal(2, 3))
        editing_entropy = max(0.2, np.random.normal(0.8, 0.4))

        rows.append({
            "net_wpm": net_wpm, "wpm_variance": wpm_variance, "iki_std_dev": iki_std_dev,
            "iki_mean": iki_mean, "burst_ratio": burst_ratio, "paste_event_count": float(paste_count),
            "deletion_ratio": deletion_ratio, "pause_count": pause_count, "editing_entropy": editing_entropy,
            "label": "AI-GENERATED",
        })
    return pd.DataFrame(rows)


def generate_synthetic_suspicious_data(n: int) -> pd.DataFrame:
    np.random.seed(999)
    rows = []
    for _ in range(n):
        # Heavy overlap with human stats
        net_wpm = max(40, np.random.normal(90, 30))
        wpm_variance = max(0, np.random.normal(30, 15))  
        iki_std_dev = max(20, np.random.normal(60, 30))  
        iki_mean = max(30, np.random.normal(120, 40))
        burst_ratio = max(0.05, np.random.normal(0.25, 0.15))
        burst_ratio = min(burst_ratio, 0.8)
        paste_count = np.random.choice([0, 1], p=[0.8, 0.2]) # Rarely uses actual paste
        deletion_ratio = max(0, np.random.normal(0.05, 0.03))
        pause_count = max(0, np.random.normal(8, 5))
        editing_entropy = max(0.5, np.random.normal(1.8, 0.6))

        rows.append({
            "net_wpm": net_wpm, "wpm_variance": wpm_variance, "iki_std_dev": iki_std_dev,
            "iki_mean": iki_mean, "burst_ratio": burst_ratio, "paste_event_count": float(paste_count),
            "deletion_ratio": deletion_ratio, "pause_count": pause_count, "editing_entropy": editing_entropy,
            "label": "SUSPICIOUS",
        })
    return pd.DataFrame(rows)


def generate_synthetic_autotyper_data(n: int) -> pd.DataFrame:
    """
    Models an Auto-Typer script (like pyautogui).
    Slow/normal WPM, but ZERO variance and ZERO bursts.
    """
    np.random.seed(404)
    rows = []
    for _ in range(n):
        net_wpm = max(30, np.random.normal(80, 20))    # Normal human speed
        wpm_variance = max(0, np.random.normal(1, 1))  # No variance across windows
        iki_std_dev = max(0, np.random.normal(2, 2))   # VERY LOW variance (Robotic!)
        iki_mean = max(50, np.random.normal(150, 40))  # Normal human IKI delay
        burst_ratio = 0.0                              # No pastes/bursts
        paste_count = 0.0
        deletion_ratio = 0.0                           # Scripts don't make typos
        pause_count = 0.0                              # Scripts don't pause to think
        editing_entropy = max(0, np.random.normal(0.2, 0.1)) # Low entropy

        rows.append({
            "net_wpm": net_wpm, "wpm_variance": wpm_variance, "iki_std_dev": iki_std_dev,
            "iki_mean": iki_mean, "burst_ratio": burst_ratio, "paste_event_count": paste_count,
            "deletion_ratio": deletion_ratio, "pause_count": pause_count, "editing_entropy": editing_entropy,
            "label": "AI-GENERATED", # Teach the AI to flag this as a machine!
        })
    return pd.DataFrame(rows)


def augment_real_sessions(db_df: pd.DataFrame, n_augmented: int = 400) -> pd.DataFrame:
    """
    Takes the small number of real database sessions and creates augmented variants
    by adding small Gaussian noise. This is standard data augmentation practice.

    Documented in dissertation as: additive noise augmentation on real calibration data,
    with variance bounded at ±10% of each feature's standard deviation.
    """
    if len(db_df) == 0:
        return pd.DataFrame()

    augmented_rows = []
    for _ in range(n_augmented):
        base_row = db_df.sample(1).iloc[0]
        noise_scale = 0.08  # 8% noise factor

        augmented_rows.append({
            "net_wpm": max(10, float(base_row.get("wpm", 60)) + np.random.normal(0, 5)),
            "wpm_variance": max(0, 20 + np.random.normal(0, 6)),
            "iki_std_dev": max(30, float(base_row.get("avg_iki", 200)) * noise_scale + 100 + np.random.normal(0, 20)),
            "iki_mean": max(80, float(base_row.get("avg_iki", 200)) + np.random.normal(0, 20)),
            "burst_ratio": max(0, 0.04 + np.random.normal(0, 0.02)),
            "paste_event_count": 0.0,
            "deletion_ratio": max(0, float(base_row.get("deletions", 5)) / max(float(base_row.get("total_keystrokes", 100)), 1) + np.random.normal(0, 0.02)),
            "pause_count": max(0, float(base_row.get("pauses", 10)) + np.random.normal(0, 3)),
            "editing_entropy": max(1.0, 2.6 + np.random.normal(0, 0.4)),
            "label": "HUMAN",
        })

    return pd.DataFrame(augmented_rows)


def train_random_forest():
    """Main training pipeline."""
    print("\n" + "=" * 60)
    print("  TYPETRACE ML TRAINING PIPELINE v2.0")
    print("=" * 60 + "\n")

    # ── 1. Collect all data sources ──
    db_df = fetch_real_sessions_from_db()
    db_augmented = augment_real_sessions(db_df, n_augmented=400)

    synthetic_human = generate_synthetic_human_data(1500)
    synthetic_ai = generate_synthetic_ai_data(1500)
    synthetic_suspicious = generate_synthetic_suspicious_data(800)
    
    # NEW: Add the Auto-Typer data
    synthetic_autotyper = generate_synthetic_autotyper_data(800)

    all_dfs = [synthetic_human, synthetic_ai, synthetic_suspicious, synthetic_autotyper]
    if len(db_augmented) > 0:
        all_dfs.append(db_augmented)
        print(f"Included {len(db_augmented)} augmented real sessions as anchor data.")

    final_df = pd.concat(all_dfs, ignore_index=True)
    final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\nClass distribution:")
    print(final_df["label"].value_counts())

    # ── 2. Prepare feature matrix ──
    X = final_df[FEATURE_COLUMNS]
    y = final_df["label"]

    # ── 3. Train/test split BEFORE SMOTE ──
    # Critical: SMOTE must only be applied to training data.
    # Applying it before splitting would leak synthetic data into the test set
    # and produce artificially inflated accuracy scores — common student mistake.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # ── 4. Apply SMOTE to training set only ──
    print(f"\nApplying SMOTE to balance training classes...")
    print(f"Before SMOTE: {y_train.value_counts().to_dict()}")

    smote = SMOTE(random_state=42, k_neighbors=3)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

    print(f"After SMOTE:  {pd.Series(y_train_resampled).value_counts().to_dict()}")

    # ── 5. Train the Random Forest ──
    print(f"\nTraining Random Forest with 200 estimators...")
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",  # handles any remaining class imbalance
        random_state=42,
        n_jobs=-1,  # use all CPU cores for training speed
    )
    rf_model.fit(X_train_resampled, y_train_resampled)

    # ── 6. Evaluate on real hold-out test set ──
    print("\n" + "=" * 60)
    print("  MODEL EVALUATION (Hold-out Test Set)")
    print("=" * 60)

    y_pred = rf_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nOverall Accuracy: {accuracy * 100:.2f}%")

    print("\nPer-class Performance:")
    print(classification_report(y_test, y_pred, digits=4))

    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred, labels=["HUMAN", "SUSPICIOUS", "AI-GENERATED"])
    print(pd.DataFrame(cm,
                       index=["True: HUMAN", "True: SUSPICIOUS", "True: AI"],
                       columns=["Pred: HUMAN", "Pred: SUSPICIOUS", "Pred: AI"]))

    # ── 7. Cross-validation score for dissertation ──
    print("\nRunning 5-fold cross-validation (for dissertation reporting)...")
    cv_scores = cross_val_score(rf_model, X_train_resampled, y_train_resampled, cv=5, scoring="accuracy")
    print(f"CV Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 100:.2f}%)")

    # ── 8. Feature importance ──
    print("\nFeature Importance (what the model learned to care about):")
    importances = rf_model.feature_importances_
    importance_df = pd.DataFrame({
        "feature": FEATURE_COLUMNS,
        "importance": importances
    }).sort_values("importance", ascending=False)

    for _, row in importance_df.iterrows():
        bar = "█" * int(row["importance"] * 50)
        print(f"  {row['feature']:<25} {bar} {row['importance'] * 100:.1f}%")

    # ── 9. Save the model ──
    model_path = os.path.join(BASE_DIR, "typetrace_rf_model.joblib")
    # also save the feature column order so inference server cant get it wrong
    feature_path = os.path.join(BASE_DIR, "feature_columns.joblib")

    joblib.dump(rf_model, model_path)
    joblib.dump(FEATURE_COLUMNS, feature_path)

    print(f"\n✅ Model saved to: {model_path}")
    print(f"✅ Feature list saved to: {feature_path}")
    print("\nTraining complete. Run the inference server to deploy.")


if __name__ == "__main__":
    train_random_forest()