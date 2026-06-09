# backend/app/ml/analyze_dataset.py

import argparse
import logging
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("TypeTrace-Analysis")


def analyze_and_report(data_dir: str, output_dir: str = "dissertation_figures") -> None:
    """
    Loads the González dataset, extracts features, and saves dissertation-ready
    statistical summary tables.
    """

    from app.ml.train_model import FEATURE_COLUMNS, load_gonzalez_dataset

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    log.info("Loading González et al. dataset...")
    df = load_gonzalez_dataset(data_dir)

    if len(df) == 0:
        log.error("No data loaded. Check --data_dir path.")
        return

    human_df = df[df["label"] == "HUMAN"]
    synthetic_df = df[df["label"] == "SYNTHETIC"]

    summary = pd.DataFrame(
        {
            "Metric": [
                "Total sessions",
                "Human sessions",
                "Synthetic sessions",
                "Mean FT mean (ms)",
                "Mean FT std (ms)",
                "Mean FT entropy",
                "Mean HT mean (ms)",
                "Mean HT std (ms)",
                "Mean FT autocorrelation",
                "Mean pause ratio",
            ],
            "HUMAN": [
                len(human_df),
                len(human_df),
                "-",
                f"{human_df['ft_mean'].mean():.1f}",
                f"{human_df['ft_std'].mean():.1f}",
                f"{human_df['ft_entropy'].mean():.3f}",
                f"{human_df['ht_mean'].mean():.1f}",
                f"{human_df['ht_std'].mean():.1f}",
                f"{human_df['ft_autocorr'].mean():.3f}",
                f"{human_df['pause_ratio'].mean():.4f}",
            ],
            "SYNTHETIC": [
                len(synthetic_df),
                "-",
                len(synthetic_df),
                f"{synthetic_df['ft_mean'].mean():.1f}",
                f"{synthetic_df['ft_std'].mean():.1f}",
                f"{synthetic_df['ft_entropy'].mean():.3f}",
                f"{synthetic_df['ht_mean'].mean():.1f}",
                f"{synthetic_df['ht_std'].mean():.1f}",
                f"{synthetic_df['ft_autocorr'].mean():.3f}",
                f"{synthetic_df['pause_ratio'].mean():.4f}",
            ],
        }
    )

    summary_path = output_path / "dissertation_table_dataset_summary.csv"
    summary.to_csv(summary_path, index=False)
    log.info("Saved: %s", summary_path)

    feature_columns = [column for column in FEATURE_COLUMNS if column in df.columns]

    feature_comparison = pd.DataFrame(
        {
            "Feature": feature_columns,
            "HUMAN mean": [
                f"{human_df[column].mean():.3f}"
                if column in human_df.columns
                else "N/A"
                for column in feature_columns
            ],
            "SYNTHETIC mean": [
                f"{synthetic_df[column].mean():.3f}"
                if column in synthetic_df.columns
                else "N/A"
                for column in feature_columns
            ],
            "Abs diff": [
                f"{abs(human_df[column].mean() - synthetic_df[column].mean()):.3f}"
                if column in human_df.columns and column in synthetic_df.columns
                else "N/A"
                for column in feature_columns
            ],
        }
    )

    feature_path = output_path / "dissertation_table_feature_comparison.csv"
    feature_comparison.to_csv(feature_path, index=False)
    log.info("Saved: %s", feature_path)

    model_path = Path(__file__).parent / "typetrace_rf_model.joblib"

    if model_path.exists():
        from sklearn.model_selection import StratifiedKFold, cross_val_score
        from sklearn.preprocessing import LabelEncoder, StandardScaler

        log.info("Running 5-fold cross-validation for dissertation results...")

        valid_rows = df[feature_columns].notna().all(axis=1)
        X = df.loc[valid_rows, feature_columns].values
        y = df.loc[valid_rows, "label"].values

        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = joblib.load(model_path)

        cv = StratifiedKFold(
            n_splits=5,
            shuffle=True,
            random_state=42,
        )
        cv_scores = cross_val_score(
            model,
            X_scaled,
            y_encoded,
            cv=cv,
            scoring="accuracy",
            n_jobs=-1,
        )

        cv_results = pd.DataFrame(
            {
                "Fold": list(range(1, 6)) + ["Mean", "Std"],
                "Accuracy": [f"{score:.4f}" for score in cv_scores]
                + [
                    f"{cv_scores.mean():.4f}",
                    f"{cv_scores.std():.4f}",
                ],
            }
        )

        cv_path = output_path / "dissertation_table_cv_results.csv"
        cv_results.to_csv(cv_path, index=False)

        log.info(
            "5-Fold CV Accuracy: %.2f%% ± %.2f%%",
            cv_scores.mean() * 100,
            cv_scores.std() * 100,
        )
        log.info("Saved: %s", cv_path)
    else:
        log.warning("Model not found. Run train_model.py first for CV results.")

    log.info("All dissertation analysis outputs saved to: %s", output_path.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data_dir",
        required=True,
        help="Path to González et al. dataset root directory.",
    )
    parser.add_argument(
        "--output_dir",
        default="dissertation_figures",
        help="Directory for generated dissertation tables.",
    )

    args = parser.parse_args()
    analyze_and_report(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
    )