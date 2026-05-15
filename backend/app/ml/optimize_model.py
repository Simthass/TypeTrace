import optuna
import pandas as pd
import numpy as np
import os
import warnings
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
import optuna.visualization as vis

warnings.filterwarnings("ignore")

# Import your data generation functions from your existing train_model.py
from train_model import (
    fetch_real_sessions_from_db, augment_real_sessions,
    generate_synthetic_human_data, generate_synthetic_ai_data,
    generate_synthetic_suspicious_data, generate_synthetic_autotyper_data,
    FEATURE_COLUMNS
)

def load_all_data():
    """Loads and combines all data sources exactly like your training script."""
    print("Loading data for optimization...")
    db_df = fetch_real_sessions_from_db()
    db_augmented = augment_real_sessions(db_df, n_augmented=400)

    synthetic_human = generate_synthetic_human_data(1500)
    synthetic_ai = generate_synthetic_ai_data(1500)
    synthetic_suspicious = generate_synthetic_suspicious_data(800)
    synthetic_autotyper = generate_synthetic_autotyper_data(800)

    all_dfs = [synthetic_human, synthetic_ai, synthetic_suspicious, synthetic_autotyper]
    if len(db_augmented) > 0:
        all_dfs.append(db_augmented)

    final_df = pd.concat(all_dfs, ignore_index=True)
    return final_df[FEATURE_COLUMNS], final_df["label"]

# Load data once into memory
X, y = load_all_data()

def objective(trial):
    """
    The Optuna objective function. 
    Optuna will run this function 100 times, injecting different parameters each time
    to find the mathematically perfect combination.
    """
    # 1. Define the hyperparameter search space
    n_estimators = trial.suggest_int('n_estimators', 50, 300, step=50)
    max_depth = trial.suggest_int('max_depth', 5, 25)
    min_samples_split = trial.suggest_int('min_samples_split', 2, 10)
    min_samples_leaf = trial.suggest_int('min_samples_leaf', 1, 5)

    # 2. Set up the Random Forest with the trial's parameters
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_split=min_samples_split,
        min_samples_leaf=min_samples_leaf,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    # 3. Create the Academic Pipeline (SMOTE must happen INSIDE cross-validation)
    pipeline = ImbPipeline([
        ('smote', SMOTE(random_state=42, k_neighbors=3)),
        ('rf', rf)
    ])

    # 4. Evaluate using 5-Fold Cross-Validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring='accuracy', n_jobs=-1)
    
    return scores.mean()

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(" 🚀 INITIATING BAYESIAN HYPERPARAMETER OPTIMIZATION")
    print("=" * 60 + "\n")

    # Create the Optuna Study
    study = optuna.create_study(direction="maximize", study_name="TypeTrace_RF_Optimization")
    
    # Run 50 trials (takes a few minutes depending on CPU)
    study.optimize(objective, n_trials=50)

    print("\n" + "=" * 60)
    print(" 🏆 OPTIMIZATION COMPLETE")
    print("=" * 60)
    
    print(f"\nBest Cross-Validated Accuracy: {study.best_value * 100:.2f}%")
    print("Best Parameters to use in train_model.py:")
    for key, value in study.best_params.items():
        print(f"    {key}: {value}")

    # Generate Dissertation Graphs (HTML files you can open in Chrome and screenshot)
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        
        # 1. Optimization History (Shows the AI learning the best parameters over time)
        fig1 = vis.plot_optimization_history(study)
        fig1.write_html(os.path.join(BASE_DIR, "opt_history.html"))
        
        # 2. Parameter Importances (Proves which settings actually mattered)
        fig2 = vis.plot_param_importances(study)
        fig2.write_html(os.path.join(BASE_DIR, "opt_importances.html"))
        
        print(f"\n📈 Graphs saved! Open 'opt_history.html' and 'opt_importances.html' in your browser to screenshot for your dissertation.")
    except Exception as e:
        print(f"Could not generate graphs: {e}")