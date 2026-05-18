import optuna
import pandas as pd
import warnings
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold, train_test_split
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
import optuna.visualization as vis

warnings.filterwarnings("ignore")

from train_model import (
    fetch_real_sessions_from_db, augment_real_sessions,
    generate_synthetic_human_data, generate_synthetic_ai_data,
    generate_synthetic_suspicious_data, generate_synthetic_autotyper_data,
    FEATURE_COLUMNS
)

def load_all_data():
    print("Loading data for optimization...")
    db_df = fetch_real_sessions_from_db()
    db_augmented = augment_real_sessions(db_df, n_augmented=400)
    all_dfs = [
        generate_synthetic_human_data(1500), generate_synthetic_ai_data(1500),
        generate_synthetic_suspicious_data(800), generate_synthetic_autotyper_data(800)
    ]
    if len(db_augmented) > 0: all_dfs.append(db_augmented)
    final_df = pd.concat(all_dfs, ignore_index=True)
    return final_df[FEATURE_COLUMNS], final_df["label"]

# ── FIX 4: The Sacred Test Set (Prevent Data Leak) ──
X_full, y_full = load_all_data()
X_optuna, X_sacred, y_optuna, y_sacred = train_test_split(X_full, y_full, test_size=0.15, random_state=42, stratify=y_full)

def objective(trial):
    n_estimators = trial.suggest_int('n_estimators', 50, 300, step=50)
    max_depth = trial.suggest_int('max_depth', 5, 25)
    min_samples_split = trial.suggest_int('min_samples_split', 2, 10)
    min_samples_leaf = trial.suggest_int('min_samples_leaf', 1, 5)

    rf = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth,
                                min_samples_split=min_samples_split, min_samples_leaf=min_samples_leaf,
                                class_weight="balanced", random_state=42, n_jobs=-1)

    min_class_count = y_optuna.value_counts().min()
    safe_k = max(1, min(3, min_class_count - 1))
    
    pipeline = ImbPipeline([('smote', SMOTE(random_state=42, k_neighbors=safe_k)), ('rf', rf)])
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X_optuna, y_optuna, cv=cv, scoring='accuracy', n_jobs=-1)
    return scores.mean()

if __name__ == "__main__":
    study = optuna.create_study(direction="maximize", study_name="TypeTrace_Optimization")
    study.optimize(objective, n_trials=50)
    print(f"\nBest Cross-Validated Accuracy: {study.best_value * 100:.2f}%")