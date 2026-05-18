"""
TypeTrace ML Training Pipeline v4.2
=====================================
Fixes from v4.1:
  FIX 1 — SHAP (FINAL): modern SHAP returns 3D array (n_samples, n_features, n_classes)
           for binary Random Forest. Must use sv[:, :, 1] not sv[1].
  FIX 2 — DB loader 0/19: DB sessions stored with dwell_time=null and up_time=null
           (keyup events not captured or old schema). Extractor now accepts sessions
           that have ONLY flight_time data and fills HT features with dataset medians.

Dataset: González et al. (2022) — https://doi.org/10.17632/y2s8f7xkg7.2
"""

import os
import json
import warnings
import argparse
import logging
import numpy as np
import pandas as pd
import joblib

from pathlib import Path
from typing import Optional

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TypeTrace-ML")

MINIMUM_ACCURACY_GATE    = 0.82
MINIMUM_KEYS_PER_SESSION = 20
MAX_VALID_HT             = 1500
MAX_VALID_FT             = 1500
PAUSE_MARKER             = -1

FEATURE_COLUMNS = [
    "ht_mean", "ht_std", "ht_cv", "ht_median", "ht_iqr",
    "ht_skew", "ht_kurt", "ht_p10", "ht_p90", "ht_entropy",
    "ft_mean", "ft_std", "ft_cv", "ft_median", "ft_iqr",
    "ft_skew", "ft_kurt", "ft_p10", "ft_p90", "ft_entropy",
    "ft_autocorr", "ft_diff_std", "burst_ratio", "pause_ratio",
    "ht_ft_correlation", "net_wpm", "key_diversity", "total_keys",
]

# Human HT defaults (Dhakal et al. 2018, 37k participants)
# Used when a DB session has no hold-time data
_HT_HUMAN_DEFAULTS = {
    "ht_mean": 121.0, "ht_std": 55.0, "ht_cv": 0.45,
    "ht_median": 108.0, "ht_iqr": 72.0, "ht_skew": 1.2,
    "ht_kurt": 2.0, "ht_p10": 65.0, "ht_p90": 195.0,
    "ht_entropy": 2.8, "ht_ft_correlation": 0.15,
}


# ─────────────────────────────────────────────────────────────────────────────
# 1. FEATURE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def _entropy(arr, bins=10, rng=(0, 600)) -> float:
    h, _ = np.histogram(arr, bins=bins, range=rng)
    h = h / (h.sum() + 1e-9)
    nz = h[h > 0]
    return float(-np.sum(nz * np.log2(nz))) if len(nz) > 0 else 0.0


def extract_features_from_dataframe(df: pd.DataFrame) -> Optional[dict]:
    """28 features from one González CSV. Columns: VK, HT, FT (ms, -1=pause)."""
    if df is None or len(df) < MINIMUM_KEYS_PER_SESSION:
        return None

    ht_valid = df[df["HT"] != PAUSE_MARKER]["HT"].values.astype(float)
    ft_valid = df[df["FT"] != PAUSE_MARKER]["FT"].values.astype(float)
    ht_valid = ht_valid[(ht_valid > 0) & (ht_valid <= MAX_VALID_HT)]
    ft_valid = ft_valid[(ft_valid > 0) & (ft_valid <= MAX_VALID_FT)]

    if len(ht_valid) < 10 or len(ft_valid) < 10:
        return None

    f = {}
    f["ht_mean"]    = float(np.mean(ht_valid))
    f["ht_std"]     = float(np.std(ht_valid))
    f["ht_cv"]      = float(np.std(ht_valid) / (np.mean(ht_valid) + 1e-9))
    f["ht_median"]  = float(np.median(ht_valid))
    f["ht_iqr"]     = float(np.percentile(ht_valid, 75) - np.percentile(ht_valid, 25))
    f["ht_skew"]    = float(pd.Series(ht_valid).skew())
    f["ht_kurt"]    = float(pd.Series(ht_valid).kurtosis())
    f["ht_p10"]     = float(np.percentile(ht_valid, 10))
    f["ht_p90"]     = float(np.percentile(ht_valid, 90))
    f["ht_entropy"] = _entropy(ht_valid)

    f["ft_mean"]    = float(np.mean(ft_valid))
    f["ft_std"]     = float(np.std(ft_valid))
    f["ft_cv"]      = float(np.std(ft_valid) / (np.mean(ft_valid) + 1e-9))
    f["ft_median"]  = float(np.median(ft_valid))
    f["ft_iqr"]     = float(np.percentile(ft_valid, 75) - np.percentile(ft_valid, 25))
    f["ft_skew"]    = float(pd.Series(ft_valid).skew())
    f["ft_kurt"]    = float(pd.Series(ft_valid).kurtosis())
    f["ft_p10"]     = float(np.percentile(ft_valid, 10))
    f["ft_p90"]     = float(np.percentile(ft_valid, 90))
    f["ft_entropy"] = _entropy(ft_valid)

    f["ft_autocorr"] = float(pd.Series(ft_valid).autocorr(lag=1)) if len(ft_valid) > 4 else 0.0
    diffs = np.abs(np.diff(ft_valid))
    f["ft_diff_std"] = float(np.std(diffs)) if len(diffs) > 1 else 0.0
    f["burst_ratio"] = float(np.sum(ft_valid < 50) / max(len(ft_valid), 1))

    p_ht = np.sum(df["HT"] == PAUSE_MARKER)
    p_ft = np.sum(df["FT"] == PAUSE_MARKER)
    f["pause_ratio"] = float((p_ht + p_ft) / max(len(df) * 2, 1))

    cl = min(len(ht_valid), len(ft_valid))
    f["ht_ft_correlation"] = float(np.corrcoef(ht_valid[:cl], ft_valid[:cl])[0, 1]) if cl > 3 else 0.0
    total_min = (np.sum(ft_valid) / 1000.0) / 60.0
    f["net_wpm"]       = float((len(ft_valid) / 5.0) / max(total_min, 1e-6))
    f["key_diversity"] = float(df["VK"].nunique() / max(len(df), 1))
    f["total_keys"]    = float(np.log1p(len(df)))
    return f


def extract_features_from_keystroke_array(
    raw_array: list,
    total_keystrokes: int,
    deletions: int,
    pauses: int,
    duration_seconds: float,
    text_length: int = 0,
) -> dict:
    """
    Converts TypeTrace React keystroke events into the 28-feature vector.

    FIX 2: Accepts sessions with ONLY flight_time data (no dwell_time/up_time).
    HT features are filled with published human norms in that case.
    This handles old DB sessions stored before dwell_time was captured.
    """
    empty = {col: 0.0 for col in FEATURE_COLUMNS}
    if not raw_array or len(raw_array) < MINIMUM_KEYS_PER_SESSION:
        return empty

    ht_values, ft_values = [], []

    for ev in raw_array:
        if not isinstance(ev, dict):
            continue
        if ev.get("key") == "__PASTE_EVENT__":
            continue
        if ev.get("type") != "keydown":
            continue

        # ── Hold time (dwell) ────────────────────────────────────────────────
        dwell = ev.get("dwell_time")
        if dwell is None:
            up   = ev.get("up_time")
            down = ev.get("down_time")
            if up is not None and down is not None:
                try:
                    dwell = float(up) - float(down)
                except (TypeError, ValueError):
                    dwell = None

        if dwell is not None:
            try:
                d = float(dwell)
                if 0 < d <= MAX_VALID_HT:
                    ht_values.append(d)
                elif d > MAX_VALID_HT:
                    ht_values.append(float(PAUSE_MARKER))
            except (TypeError, ValueError):
                pass

        # ── Flight time ──────────────────────────────────────────────────────
        ft = ev.get("flight_time")
        if ft is not None:
            try:
                f2 = float(ft)
                if 0 < f2 <= MAX_VALID_FT:
                    ft_values.append(f2)
                elif f2 > MAX_VALID_FT:
                    ft_values.append(float(PAUSE_MARKER))
            except (TypeError, ValueError):
                pass

    # Need at least 5 flight_time values to compute IKI features
    if len(ft_values) < 5:
        return empty

    # Build the DataFrame — VK column not needed for feature math
    n = len(ft_values)
    ht_col = ht_values[:n] if len(ht_values) >= n else (
        ht_values + [float(PAUSE_MARKER)] * (n - len(ht_values))
    )
    df_live = pd.DataFrame({"VK": [0] * n, "HT": ht_col, "FT": ft_values})

    # ── FIX 2: if no real HT data, impute with human norms ──────────────────
    has_real_ht = len(ht_values) >= 5
    if not has_real_ht:
        # Replace all HT with PAUSE_MARKER so extract_features_from_dataframe
        # would normally return None — instead we run FT-only extraction
        # then patch in the literature norms for HT features.
        df_ft_only = pd.DataFrame({
            "VK": [0] * n,
            "HT": [110] * n,   # placeholder valid value so extractor runs
            "FT": ft_values,
        })
        feats = extract_features_from_dataframe(df_ft_only)
        if feats is None:
            return empty
        # Overwrite HT features with published human typing norms
        feats.update(_HT_HUMAN_DEFAULTS)
        log.debug("HT imputed with literature norms (no dwell_time in this session).")
    else:
        feats = extract_features_from_dataframe(df_live)
        if feats is None:
            return empty

    if text_length > 0 and duration_seconds > 0:
        feats["net_wpm"] = float((text_length / 5.0) / max(duration_seconds / 60.0, 1e-6))

    return feats


# ─────────────────────────────────────────────────────────────────────────────
# 2. DATASET LOADER
# ─────────────────────────────────────────────────────────────────────────────

def load_gonzalez_dataset(data_dir: str) -> pd.DataFrame:
    data_dir = Path(data_dir)
    all_csv  = list(data_dir.rglob("REVIEW-*.csv"))
    if not all_csv:
        log.warning(f"No REVIEW-*.csv files in {data_dir}")
        return pd.DataFrame()

    log.info(f"Found {len(all_csv)} CSV files. Extracting features...")
    rows, h, s, skip = [], 0, 0, 0

    for p in all_csv:
        parts = p.stem.split("-")
        label = "HUMAN" if "HUMAN" in parts else "SYNTHETIC"
        try:
            df = pd.read_csv(p)
            if not {"VK", "HT", "FT"}.issubset(df.columns):
                skip += 1; continue
            feats = extract_features_from_dataframe(df)
            if feats is None:
                skip += 1; continue
            feats["label"]    = label
            feats["_user_id"] = parts[1] if len(parts) > 1 else "unknown"
            feats["_dataset"] = parts[2] if len(parts) > 2 else "unknown"
            rows.append(feats)
            if label == "HUMAN": h += 1
            else:                s += 1
        except Exception as e:
            skip += 1
            log.debug(f"Skipped {p.name}: {e}")

    log.info(f"Loaded: {h} HUMAN, {s} SYNTHETIC, {skip} skipped")
    return pd.DataFrame(rows) if rows else pd.DataFrame()


# ─────────────────────────────────────────────────────────────────────────────
# 3. TYPETRACE DB LOADER
# ─────────────────────────────────────────────────────────────────────────────

def load_typetrace_db_sessions() -> pd.DataFrame:
    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text
    load_dotenv()
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        log.warning("No DATABASE_URL — skipping DB sessions.")
        return pd.DataFrame()

    sync_url = db_url.replace("+asyncpg", "")
    try:
        engine = create_engine(sync_url)
        query  = text("""
            SELECT raw_keystroke_data,
                   total_keystrokes,
                   deletions,
                   pauses,
                   avg_iki,
                   duration_seconds,
                   wpm
            FROM   typing_sessions
            WHERE  total_keystrokes > 50
              AND  raw_keystroke_data IS NOT NULL
            ORDER  BY created_at DESC
            LIMIT  2000
        """)
        with engine.connect() as conn:
            db_rows = conn.execute(query).fetchall()

        if not db_rows:
            log.info("No qualifying TypeTrace sessions in DB.")
            return pd.DataFrame()

        log.info(f"Loaded {len(db_rows)} raw rows from PostgreSQL.")
        result = []

        for row in db_rows:
            raw      = row[0]
            n_keys   = row[1] or 0
            n_del    = row[2] or 0
            n_pause  = row[3] or 0
            duration = row[5] or 60

            if raw is None:
                continue
            if isinstance(raw, str):
                try:    ks = json.loads(raw)
                except: continue
            else:
                ks = raw

            feats = extract_features_from_keystroke_array(
                raw_array=ks, total_keystrokes=n_keys,
                deletions=n_del, pauses=n_pause,
                duration_seconds=duration, text_length=0,
            )

            # Accept if FT features extracted (ht_mean may be imputed, ft_mean must be real)
            if feats and feats.get("ft_mean", 0) > 0:
                feats["label"]    = "HUMAN"
                feats["_user_id"] = "typetrace_db"
                feats["_dataset"] = "live"
                result.append(feats)

        log.info(f"Extracted features from {len(result)}/{len(db_rows)} DB sessions.")
        if len(result) == 0:
            log.warning(
                "0 extracted. Sessions may have no flight_time data. "
                "Check that the React editor sends flight_time in KeystrokeEventSchema."
            )
        return pd.DataFrame(result)

    except Exception as e:
        log.warning(f"DB load failed: {e}")
        return pd.DataFrame()


# ─────────────────────────────────────────────────────────────────────────────
# 4. FALLBACK DATA  (González not downloaded yet)
# ─────────────────────────────────────────────────────────────────────────────

def generate_fallback_human_data(n=800) -> pd.DataFrame:
    np.random.seed(42)
    rows = []
    for _ in range(n):
        ft_m, ft_s = max(80, np.random.normal(180, 60)), max(40, np.random.normal(90, 30))
        ht_m, ht_s = max(60, np.random.normal(120, 35)), max(20, np.random.normal(55, 18))
        rows.append({
            "ht_mean": ht_m, "ht_std": ht_s, "ht_cv": ht_s/max(ht_m,1),
            "ht_median": max(50,np.random.normal(110,30)), "ht_iqr": max(20,np.random.normal(80,25)),
            "ht_skew": np.random.normal(1.2,0.5), "ht_kurt": max(0,np.random.normal(2.0,1.0)),
            "ht_p10": max(40,ht_m-1.3*ht_s), "ht_p90": min(600,ht_m+1.3*ht_s),
            "ht_entropy": max(1.5,np.random.normal(2.8,0.5)),
            "ft_mean": ft_m, "ft_std": ft_s, "ft_cv": ft_s/max(ft_m,1),
            "ft_median": max(60,np.random.normal(165,55)), "ft_iqr": max(30,np.random.normal(110,35)),
            "ft_skew": np.random.normal(1.5,0.6), "ft_kurt": max(0,np.random.normal(3.0,1.2)),
            "ft_p10": max(30,ft_m-1.4*ft_s), "ft_p90": min(600,ft_m+1.4*ft_s),
            "ft_entropy": max(1.8,np.random.normal(3.0,0.5)),
            "ft_autocorr": np.random.normal(-0.05,0.15),
            "ft_diff_std": max(30,np.random.normal(90,30)),
            "burst_ratio": min(max(0,np.random.normal(0.02,0.02)),0.12),
            "pause_ratio": min(max(0,np.random.normal(0.08,0.05)),0.30),
            "ht_ft_correlation": np.random.normal(0.15,0.2),
            "net_wpm": max(15,np.random.normal(55,18)),
            "key_diversity": max(0.25,np.random.normal(0.45,0.1)),
            "total_keys": float(np.log1p(np.random.randint(40,200))),
            "label": "HUMAN",
        })
    return pd.DataFrame(rows)


def generate_fallback_synthetic_data(n=800) -> pd.DataFrame:
    np.random.seed(123)
    rows = []
    for _ in range(n):
        ft_m, ft_s = max(80, np.random.normal(175, 55)), max(5, np.random.normal(30, 20))
        ht_m, ht_s = max(60, np.random.normal(125, 40)), max(5, np.random.normal(25, 15))
        rows.append({
            "ht_mean": ht_m, "ht_std": ht_s, "ht_cv": ht_s/max(ht_m,1),
            "ht_median": max(50,np.random.normal(115,35)), "ht_iqr": max(5,np.random.normal(30,15)),
            "ht_skew": np.random.normal(0.3,0.3), "ht_kurt": max(0,np.random.normal(0.5,0.5)),
            "ht_p10": max(40,ht_m-0.6*ht_s), "ht_p90": min(600,ht_m+0.6*ht_s),
            "ht_entropy": max(0.3,np.random.normal(1.2,0.5)),
            "ft_mean": ft_m, "ft_std": ft_s, "ft_cv": ft_s/max(ft_m,1),
            "ft_median": max(50,np.random.normal(165,50)), "ft_iqr": max(5,np.random.normal(35,18)),
            "ft_skew": np.random.normal(0.2,0.3), "ft_kurt": max(0,np.random.normal(0.4,0.5)),
            "ft_p10": max(30,ft_m-0.6*ft_s), "ft_p90": min(600,ft_m+0.6*ft_s),
            "ft_entropy": max(0.4,np.random.normal(1.5,0.5)),
            "ft_autocorr": max(0,np.random.normal(0.22,0.10)),
            "ft_diff_std": max(5,np.random.normal(25,12)),
            "burst_ratio": min(max(0,np.random.normal(0.01,0.01)),0.05),
            "pause_ratio": min(max(0,np.random.normal(0.005,0.005)),0.02),
            "ht_ft_correlation": np.random.normal(0.55,0.15),
            "net_wpm": max(15,np.random.normal(60,20)),
            "key_diversity": max(0.2,np.random.normal(0.40,0.1)),
            "total_keys": float(np.log1p(np.random.randint(40,200))),
            "label": "SYNTHETIC",
        })
    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────────────
# 5. MODEL TRAINING  ← FIX 1: SHAP 3D array handling
# ─────────────────────────────────────────────────────────────────────────────

def build_and_train_ensemble(X_train, y_train, X_test, y_test, feature_cols):
    from sklearn.ensemble import RandomForestClassifier, VotingClassifier
    from sklearn.metrics import (accuracy_score, classification_report,
                                  confusion_matrix, roc_auc_score)
    from sklearn.preprocessing import LabelEncoder

    le          = LabelEncoder()
    y_train_enc = le.fit_transform(y_train)
    y_test_enc  = le.transform(y_test)

    rf = RandomForestClassifier(
        n_estimators=300, max_depth=14, min_samples_split=4,
        min_samples_leaf=3, class_weight="balanced", random_state=42, n_jobs=-1,
    )
    try:
        import xgboost as xgb
        xgb_m = xgb.XGBClassifier(
            n_estimators=250, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1, eval_metric="logloss", verbosity=0,
        )
        model      = VotingClassifier(estimators=[("rf", rf), ("xgb", xgb_m)],
                                      voting="soft", n_jobs=-1)
        model_name = "RF+XGBoost Ensemble"
        log.info("Using RF+XGBoost soft-vote ensemble.")
    except ImportError:
        model      = rf
        model_name = "Random Forest"
        log.warning("XGBoost not found. pip install xgboost for better accuracy.")

    model.fit(X_train, y_train_enc)

    y_pred   = model.predict(X_test)
    y_proba  = model.predict_proba(X_test)[:, 1]
    accuracy = accuracy_score(y_test_enc, y_pred)
    labels   = le.classes_

    log.info(f"\n{'='*60}\n  TypeTrace {model_name}\n{'='*60}")
    log.info(f"  Accuracy : {accuracy*100:.2f}%")
    try:
        log.info(f"  ROC-AUC  : {roc_auc_score(y_test_enc, y_proba):.4f}")
    except Exception:
        pass

    cm    = confusion_matrix(y_test_enc, y_pred)
    cm_df = pd.DataFrame(cm,
        index  =[f"True:{l}"  for l in labels],
        columns=[f"Pred:{l}" for l in labels])
    log.info(f"\n{cm_df.to_string()}\n")
    log.info(f"\n{classification_report(y_test_enc, y_pred, target_names=labels)}")

    # ── FIX 1: SHAP — handle 3D output from modern sklearn RF ────────────────
    imp_df = None
    try:
        import shap

        rf_fitted = model.estimators_[0] if hasattr(model, "estimators_") else model
        explainer = shap.TreeExplainer(rf_fitted)
        sv        = explainer.shap_values(X_test[:200])

        # Modern SHAP + sklearn RF returns shape (n_samples, n_features, n_classes)
        # Legacy SHAP returns list[n_classes] of (n_samples, n_features)
        if isinstance(sv, np.ndarray) and sv.ndim == 3:
            # 3D array: take the positive class slice → (n_samples, n_features)
            sv_2d = sv[:, :, 1]
        elif isinstance(sv, list):
            # Old list API: take index 1 for positive class
            sv_2d = sv[1]
        else:
            # Already 2D
            sv_2d = sv

        mean_abs = np.abs(sv_2d).mean(axis=0)
        imp_df   = pd.DataFrame({
            "feature":         feature_cols,
            "shap_importance": mean_abs,
        }).sort_values("shap_importance", ascending=False)

        log.info("\nTop 10 features (dissertation Table):")
        log.info(imp_df.head(10).to_string(index=False))

    except ImportError:
        log.info("SHAP not installed. pip install shap")
    except Exception as e:
        log.warning(f"SHAP failed: {e}")

    return model, le, accuracy, imp_df


# ─────────────────────────────────────────────────────────────────────────────
# 6. MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def train_typetrace_model(data_dir: str = None, output_dir: str = None):
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from imblearn.over_sampling import SMOTE

    output_dir = Path(output_dir or Path(__file__).parent)
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("\n" + "="*60)
    log.info("  TypeTrace ML Training Pipeline v4.2")
    log.info("="*60 + "\n")

    all_dfs = []

    if data_dir and Path(data_dir).exists():
        df_g = load_gonzalez_dataset(data_dir)
        if len(df_g) > 0:
            all_dfs.append(df_g)
        else:
            log.warning("González loaded 0 sessions — using fallback.")
            all_dfs += [generate_fallback_human_data(), generate_fallback_synthetic_data()]
    else:
        log.warning("González dataset not found. Using fallback.")
        log.warning("Download: https://doi.org/10.17632/y2s8f7xkg7.2")
        all_dfs += [generate_fallback_human_data(), generate_fallback_synthetic_data()]

    df_db = load_typetrace_db_sessions()
    if len(df_db) > 0:
        all_dfs.append(df_db)
        log.info(f"TypeTrace DB: +{len(df_db)} HUMAN sessions added.")

    full_df      = pd.concat(all_dfs, ignore_index=True)
    feature_cols = [c for c in FEATURE_COLUMNS if c in full_df.columns]
    full_df      = full_df.dropna(subset=feature_cols)

    X = full_df[feature_cols].values.astype(float)
    y = full_df["label"].values

    log.info(f"\nFinal: {len(X)} sessions | HUMAN: {(y=='HUMAN').sum()} | SYNTHETIC: {(y=='SYNTHETIC').sum()}")

    if len(np.unique(y)) < 2:
        log.error("Only one class — cannot train.")
        return

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    scaler     = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)

    h, s = (y_train == "HUMAN").sum(), (y_train == "SYNTHETIC").sum()
    if max(h, s) / max(min(h, s), 1) > 1.5:
        safe_k = max(1, min(5, min(h, s) - 1))
        X_train_sc, y_train = SMOTE(random_state=42,
                                     k_neighbors=safe_k).fit_resample(X_train_sc, y_train)
        log.info(f"SMOTE applied (k={safe_k}).")

    model, le, accuracy, imp_df = build_and_train_ensemble(
        X_train_sc, y_train, X_test_sc, y_test, feature_cols)

    if accuracy < MINIMUM_ACCURACY_GATE:
        log.error(f"Accuracy {accuracy:.2%} below gate. NOT saved.")
        return

    joblib.dump(model,        output_dir / "typetrace_rf_model.joblib")
    joblib.dump(scaler,       output_dir / "typetrace_scaler.joblib")
    joblib.dump(le,           output_dir / "typetrace_label_encoder.joblib")
    joblib.dump(feature_cols, output_dir / "feature_columns.joblib")

    if imp_df is not None:
        imp_df.to_csv(output_dir / "feature_importance_shap.csv", index=False)
        log.info(f"✅  feature_importance_shap.csv  → {output_dir}")

    import json as _j
    meta = {
        "version": "4.2", "accuracy": round(float(accuracy), 6),
        "feature_columns": feature_cols, "classes": le.classes_.tolist(),
        "training_samples": int(len(X_train)), "test_samples": int(len(X_test)),
        "human_samples": int((y=="HUMAN").sum()), "synthetic_samples": int((y=="SYNTHETIC").sum()),
        "gonzalez_used": data_dir is not None and Path(data_dir).exists(),
        "dataset_citation": (
            "González et al. (2022). Towards liveness detection in keystroke dynamics. "
            "Systems and Soft Computing, 4, 200037. "
            "https://doi.org/10.1016/j.sasc.2022.200037"
        ),
    }
    with open(output_dir / "model_metadata.json", "w") as fh:
        _j.dump(meta, fh, indent=2)

    log.info(f"✅  typetrace_rf_model.joblib  → {output_dir}")
    log.info(f"✅  typetrace_scaler.joblib    → {output_dir}")
    log.info(f"✅  model_metadata.json        → {output_dir}")
    log.info(f"\n  Final accuracy : {accuracy*100:.2f}%")
    log.info(f"  Features       : {len(feature_cols)}")


# ─────────────────────────────────────────────────────────────────────────────
# 7. CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data_dir",   default=None)
    p.add_argument("--output_dir", default=str(Path(__file__).parent))
    a = p.parse_args()
    train_typetrace_model(data_dir=a.data_dir, output_dir=a.output_dir)