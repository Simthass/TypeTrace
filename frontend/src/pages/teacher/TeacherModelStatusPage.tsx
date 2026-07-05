import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ErrorState, LoadingState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import { API_ROUTES } from "../../constants/apiRoutes";
import { api, getApiErrorMessage } from "../../lib/api";
import { colors } from "../../styles/colors";

type ModelStatus = {
  status?: string;
  model_available?: boolean;
  model_name?: string;
  model_version?: string;
  trained_at?: string;
  feature_count?: number;
  feature_columns?: string[];
  metrics?: Record<string, unknown>;
  decision_note?: string;
  load_error?: string | null;
  total_samples?: number;
  human_test_samples?: number;
  synthetic_test_samples?: number;
  decision_threshold?: number;
};

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 15.5-6.2" />
        <path d="M18 3v6h-6" />
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M6 21v-6h6" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    warning: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3" />
        <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

function formatPercent(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const pct = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(pct * 100) / 100}%`;
}

function formatNumber(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-md border p-4"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[24px] font-bold tracking-[-0.04em] tabular-nums"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p
        className="mt-1 text-[12px] leading-5"
        style={{ color: colors.text.secondary }}
      >
        {detail}
      </p>
    </div>
  );
}

export default function TeacherModelStatusPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<ModelStatus | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModelState = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusResponse, metricsResponse, featuresResponse] =
        await Promise.all([
          api.get<ModelStatus>(API_ROUTES.model.status),
          api.get<ModelStatus>(API_ROUTES.model.metrics),
          api.get<ModelStatus>(API_ROUTES.model.features),
        ]);

      setData({ ...statusResponse.data, ...metricsResponse.data });
      setFeatures(featuresResponse.data.feature_columns || []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadModelState();
  }, []);

  const reloadModel = async () => {
    setIsReloading(true);
    try {
      await api.post(API_ROUTES.model.reload);
      await loadModelState();
      showToast({
        type: "success",
        title: "Model reloaded",
        message: "The backend reloaded the latest local model artifacts.",
      });
    } catch (err) {
      showToast({
        type: "error",
        title: "Reload failed",
        message: getApiErrorMessage(err),
      });
    } finally {
      setIsReloading(false);
    }
  };

  const metrics = useMemo(() => data?.metrics || {}, [data]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading model status"
        message="Reading the active TypeTrace model artifacts."
      />
    );
  }

  if (error) {
    return <ErrorState title="Could not load model status" message={error} />;
  }

  const ready = Boolean(data?.model_available);

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Model operations
          </p>
          <h1
            className="mt-2 text-[28px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Isolation Forest model status
          </h1>
          <p
            className="mt-2 max-w-3xl text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Review the active behavioral liveness model, metrics, feature
            schema, and fallback readiness. Scores support academic review; they
            are not automatic misconduct decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={reloadModel}
          disabled={isReloading}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: colors.brand }}
        >
          <Icon type="refresh" size={14} />
          {isReloading ? "Reloading" : "Reload artifacts"}
        </button>
      </div>

      <div
        className="rounded-md border p-5"
        style={{
          borderColor: ready ? colors.green : colors.amber,
          background: colors.surface[50],
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md"
              style={{
                background: ready ? `${colors.green}18` : `${colors.amber}22`,
                color: ready ? colors.green : colors.amber,
              }}
            >
              <Icon type={ready ? "check" : "warning"} size={18} />
            </div>
            <div>
              <p
                className="text-[15px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {ready ? "Model ready" : "Fallback mode"}
              </p>
              <p
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {data?.model_name || "TypeTrace behavioral rules"} ·{" "}
                {data?.model_version || "fallback-rules"}
              </p>
            </div>
          </div>
          <span
            className="rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: colors.surface[200],
              color: ready ? colors.green : colors.amber,
            }}
          >
            {String(data?.status || (ready ? "ready" : "degraded")).replaceAll(
              "_",
              " ",
            )}
          </span>
        </div>
        {data?.load_error && (
          <p
            className="mt-4 rounded-md border p-3 text-[12px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            {data.load_error}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="ROC-AUC"
          value={formatNumber(metrics.roc_auc)}
          detail="Ranking quality against holdout human/synthetic samples."
        />
        <MetricCard
          label="Human recall"
          value={formatPercent(metrics.recall_human)}
          detail="Human samples accepted by the threshold."
        />
        <MetricCard
          label="Human false flag"
          value={formatPercent(metrics.false_positive_rate_human_flagged)}
          detail="Human samples incorrectly flagged as anomalous."
        />
        <MetricCard
          label="Feature count"
          value={String(features.length || data?.feature_count || 0)}
          detail="Canonical behavioral features used by inference."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section
          className="rounded-md border p-5"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <div className="flex items-center gap-2">
            <Icon type="database" size={16} />
            <h2
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Training summary
            </h2>
          </div>
          <div className="mt-5 space-y-3 text-[13px]">
            {[
              ["Trained at", data?.trained_at || "Unknown"],
              [
                "Total samples",
                formatNumber(metrics.total_samples || data?.total_samples),
              ],
              [
                "Human test samples",
                formatNumber(
                  metrics.human_test_samples || data?.human_test_samples,
                ),
              ],
              [
                "Synthetic test samples",
                formatNumber(
                  metrics.synthetic_test_samples ||
                    data?.synthetic_test_samples,
                ),
              ],
              [
                "Decision threshold",
                formatNumber(
                  metrics.decision_threshold || data?.decision_threshold,
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex justify-between gap-4 border-b pb-3 last:border-b-0"
                style={{ borderColor: colors.surface[200] }}
              >
                <span style={{ color: colors.text.muted }}>{label}</span>
                <span
                  className="font-semibold text-right"
                  style={{ color: colors.text.primary }}
                >
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="rounded-md border p-5"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <div className="flex items-center gap-2">
            <Icon type="activity" size={16} />
            <h2
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Active feature schema
            </h2>
          </div>
          <p
            className="mt-2 text-[12px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            These are derived from timing, editing, pause, paste, deletion, and
            revision behavior. No essay text content is used for the model
            features shown here.
          </p>
          <div className="mt-4 flex max-h-[340px] flex-wrap gap-2 overflow-y-auto pr-1">
            {features.map((feature) => (
              <span
                key={feature}
                className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                  color: colors.text.secondary,
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div
        className="rounded-md border p-5"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <h2
          className="text-[15px] font-bold"
          style={{ color: colors.text.primary }}
        >
          Academic interpretation note
        </h2>
        <p
          className="mt-2 text-[13px] leading-6"
          style={{ color: colors.text.secondary }}
        >
          {data?.decision_note ||
            "Isolation Forest scores are behavioral anomaly evidence, not calibrated probabilities and not automatic misconduct proof."}
        </p>
      </div>
    </div>
  );
}
