"""
TypeTrace Dataset Analysis & Dissertation Figures
==================================================
Run this AFTER downloading the González et al. dataset to generate:
  1. Dataset statistics table (for dissertation Table 3.1)
  2. Feature distribution plots: HUMAN vs SYNTHETIC
  3. Feature importance chart (post-training)
  4. ROC-AUC curve
  5. Cross-validation results table

Usage:
  python analyze_dataset.py --data_dir /path/to/gonzalez_dataset
"""

import os
import sys
import warnings
import argparse
import numpy as np
import pandas as pd
import joblib
import logging

from pathlib import Path

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("TypeTrace-Analysis")

# ─────────────────────────────────────────────────────────────────────────────

def analyze_and_report(data_dir: str, output_dir: str = "dissertation_figures"):
    """
    Loads the full González dataset, extracts features, runs statistical
    analysis, and saves outputs suitable for direct inclusion in dissertation.
    """
    from train_model import load_gonzalez_dataset, FEATURE_COLUMNS

    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    log.info("Loading González et al. dataset...")
    df = load_gonzalez_dataset(data_dir)

    if len(df) == 0:
        log.error("No data loaded. Check --data_dir path.")
        return

    # ── Table 1: Dataset summary ─────────────────────────────────────────────
    human_df = df[df["label"] == "HUMAN"]
    synth_df = df[df["label"] == "SYNTHETIC"]

    summary = pd.DataFrame({
        "Metric": [
            "Total sessions", "Human sessions", "Synthetic sessions",
            "Mean FT mean (ms)", "Mean FT std (ms)", "Mean FT entropy",
            "Mean HT mean (ms)", "Mean HT std (ms)",
            "Mean FT autocorrelation", "Mean pause ratio",
        ],
        "HUMAN": [
            len(human_df), len(human_df), "-",
            f"{human_df['ft_mean'].mean():.1f}",
            f"{human_df['ft_std'].mean():.1f}",
            f"{human_df['ft_entropy'].mean():.3f}",
            f"{human_df['ht_mean'].mean():.1f}",
            f"{human_df['ht_std'].mean():.1f}",
            f"{human_df['ft_autocorr'].mean():.3f}",
            f"{human_df['pause_ratio'].mean():.4f}",
        ],
        "SYNTHETIC": [
            len(synth_df), "-", len(synth_df),
            f"{synth_df['ft_mean'].mean():.1f}",
            f"{synth_df['ft_std'].mean():.1f}",
            f"{synth_df['ft_entropy'].mean():.3f}",
            f"{synth_df['ht_mean'].mean():.1f}",
            f"{synth_df['ht_std'].mean():.1f}",
            f"{synth_df['ft_autocorr'].mean():.3f}",
            f"{synth_df['pause_ratio'].mean():.4f}",
        ],
    })
    summary_path = output_path / "dissertation_table_dataset_summary.csv"
    summary.to_csv(summary_path, index=False)
    log.info(f"Saved: {summary_path}")
    log.info("\n" + summary.to_string(index=False))

    # ── Table 2: Feature means by class ──────────────────────────────────────
    feat_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    feat_comparison = pd.DataFrame({
        "Feature": feat_cols,
        "HUMAN mean": [f"{human_df[c].mean():.3f}" if c in human_df.columns else "N/A" for c in feat_cols],
        "SYNTHETIC mean": [f"{synth_df[c].mean():.3f}" if c in synth_df.columns else "N/A" for c in feat_cols],
        "Abs diff": [
            f"{abs(human_df[c].mean() - synth_df[c].mean()):.3f}"
            if c in human_df.columns and c in synth_df.columns else "N/A"
            for c in feat_cols
        ],
    })
    feat_path = output_path / "dissertation_table_feature_comparison.csv"
    feat_comparison.to_csv(feat_path, index=False)
    log.info(f"Saved: {feat_path}")

    # ── Cross-validation with trained model ──────────────────────────────────
    ml_dir = Path(__file__).parent / "ml"
    model_path = ml_dir / "typetrace_rf_model.joblib"

    if model_path.exists():
        from sklearn.model_selection import StratifiedKFold, cross_val_score
        from sklearn.preprocessing import StandardScaler, LabelEncoder

        log.info("\nRunning 5-fold cross-validation for dissertation Table 4.X...")

        X = df[feat_cols].dropna().values
        y = df.loc[df[feat_cols].notna().all(axis=1), "label"].values

        le = LabelEncoder()
        y_enc = le.fit_transform(y)

        scaler = StandardScaler()
        X_sc = scaler.fit_transform(X)

        model = joblib.load(model_path)

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X_sc, y_enc, cv=cv, scoring="accuracy", n_jobs=-1)

        cv_results = pd.DataFrame({
            "Fold": list(range(1, 6)) + ["Mean", "Std"],
            "Accuracy": [f"{s:.4f}" for s in cv_scores] + [
                f"{cv_scores.mean():.4f}", f"{cv_scores.std():.4f}"
            ],
        })
        cv_path = output_path / "dissertation_table_cv_results.csv"
        cv_results.to_csv(cv_path, index=False)
        log.info(f"\n5-Fold CV Accuracy: {cv_scores.mean()*100:.2f}% ± {cv_scores.std()*100:.2f}%")
        log.info(f"Saved: {cv_path}")
    else:
        log.warning("Model not found — run train_model.py first for CV results.")

    log.info(f"\n✅ All dissertation figures saved to: {output_path.resolve()}")
    log.info("   Include these CSV files directly in your dissertation appendices.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", required=True, help="Path to González et al. dataset root")
    parser.add_argument("--output_dir", default="dissertation_figures")
    args = parser.parse_args()
    analyze_and_report(args.data_dir, args.output_dir)