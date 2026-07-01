import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../../lib/api";
import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { useToast } from "../../components/ui/ToastProvider";
import { brand, colors } from "../../styles/colors";

interface JoinCourseResponse {
  message?: string;
  course_name?: string;
  course_code?: string;
  course?: {
    course_name?: string;
    course_code?: string;
  };
}

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: <path d="M19 12H5m7-7-7 7 7 7" />,
    arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    loader: (
      <>
        <path d="M21 12a9 9 0 0 1-9 9" />
        <path d="M3 12a9 9 0 0 1 9-9" />
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

function BenefitItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 last:mb-0">
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon type={icon} size={12} />
      </div>
      <div>
        <p
          className="text-[13px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          {title}
        </p>
        <p
          className="mt-0.5 text-[12px] leading-5"
          style={{ color: colors.text.secondary }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function NextStep({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
        style={{
          background: colors.surface[100],
          borderColor: colors.surface[200],
          color: colors.text.muted,
        }}
      >
        {index}
      </span>
      <p className="text-[13px]" style={{ color: colors.text.secondary }}>
        {children}
      </p>
    </div>
  );
}

export default function JoinCoursePage() {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteFocused, setIsInviteFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    course_name: string;
    course_code: string;
  } | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter an invite code.");
      showToast({
        type: "warning",
        title: "Invite code required",
        message: "Enter the course invite code provided by your teacher.",
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<JoinCourseResponse>(API_ROUTES.courses.join, {
        invite_code: code,
      });
      const courseName =
        res.data.course?.course_name || res.data.course_name || "Course";
      const courseCode =
        res.data.course?.course_code || res.data.course_code || code;

      setSuccess({
        course_name: courseName,
        course_code: courseCode,
      });
      showToast({
        type: "success",
        title: "Course joined",
        message: `You've been enrolled in ${courseName}.`,
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      const message = ax.response?.data?.detail ?? "Invalid invite code.";
      setError(message);
      showToast({
        type: "error",
        title: "Could not join course",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteChange = (value: string) => {
    setInviteCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
    setError(null);
  };

  const resetEnrollment = () => {
    setSuccess(null);
    setInviteCode("");
    setError(null);
  };

  const inputFrameStyle = {
    borderColor: error
      ? colors.red
      : isInviteFocused
        ? colors.brand
        : colors.surface[200],
    background: brand.bgCard,
    boxShadow: error
      ? `0 0 0 2px ${colors.roseTint}`
      : isInviteFocused
        ? `0 0 0 2px ${colors.brandSoft}`
        : "none",
  };

  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ background: colors.surface[100] }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[520px] flex-col justify-center">
        {!success ? (
          <section>
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              Course Enrollment
            </p>

            <h1
              className="text-[28px] font-bold leading-[1.1] tracking-[-0.04em]"
              style={{ color: colors.text.primary }}
            >
              Enter your invite code.
            </h1>

            <p
              className="mb-8 mt-3 text-[14px] leading-7"
              style={{ color: colors.text.secondary }}
            >
              Your instructor shared a unique course code. Paste it below to
              join and start submitting writing evidence.
            </p>

            <div
              className="flex items-center gap-2 rounded-md border p-1 transition-all duration-150"
              style={inputFrameStyle}
              onFocus={() => setIsInviteFocused(true)}
              onBlur={() => setIsInviteFocused(false)}
            >
              <span
                className="shrink-0 select-none pl-3 font-mono text-[15px] font-bold"
                style={{ color: colors.text.muted }}
              >
                TT—
              </span>

              <input
                type="text"
                value={inviteCode}
                onChange={(event) => handleInviteChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleJoin();
                  }
                }}
                placeholder="XXXXXXXX"
                className="h-12 flex-1 border-none bg-transparent font-mono text-[16px] font-bold uppercase tracking-[0.12em] outline-none placeholder:font-normal placeholder:tracking-normal"
                style={{ color: colors.text.primary }}
                autoCapitalize="characters"
                spellCheck={false}
              />

              <button
                type="button"
                onClick={handleJoin}
                disabled={inviteCode.trim().length < 3 || isLoading}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-[13px] font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: brand.action,
                  color: brand.textOnDark,
                }}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">
                      <Icon type="loader" size={16} />
                    </span>
                    Joining
                  </>
                ) : (
                  <>
                    Join
                    <Icon type="arrowRight" size={14} />
                  </>
                )}
              </button>
            </div>

            {error ? (
              <div
                className="mt-3 flex items-center gap-2 text-[13px] font-medium"
                style={{ color: colors.red }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-md text-[10px] font-black"
                  style={{ background: colors.roseTint, color: colors.red }}
                >
                  !
                </span>
                <span>{error}</span>
              </div>
            ) : (
              <p
                className="mt-3 text-[12px]"
                style={{ color: colors.text.muted }}
              >
                Format: TT-XXXXXXXX · Codes are case-insensitive
              </p>
            )}

            <div
              className="mt-8 border-t pt-6"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                What joining gives you
              </p>

              <BenefitItem
                icon="link"
                title="Course-linked evidence"
                description="Sessions you analyze are automatically attached to this course."
              />
              <BenefitItem
                icon="eye"
                title="Teacher review access"
                description="Your instructor can replay sessions and review certificates."
              />
              <BenefitItem
                icon="shield"
                title="Verified academic record"
                description="Certificates reference your course for institutional integrity."
              />
            </div>

            <p
              className="mt-8 text-center text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Don't have a code? Your course instructor can generate one from
              their Teacher Console.
            </p>
          </section>
        ) : (
          <section
            className="translate-y-0 rounded-md border p-8 text-center opacity-100 transition duration-300"
            style={{
              background: brand.bgCard,
              borderColor: colors.surface[200],
              boxShadow: `0 1px 3px ${colors.shadow}`,
            }}
          >
            <div
              className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md"
              style={{ background: colors.mintTint, color: colors.green }}
            >
              <Icon type="check" size={20} />
            </div>

            <div
              className="mb-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: colors.mintTint,
                borderColor: colors.green,
                color: colors.green,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-md"
                style={{ background: colors.green }}
              />
              Enrolled
            </div>

            <h2
              className="text-[22px] font-bold tracking-[-0.03em]"
              style={{ color: colors.text.primary }}
            >
              {success.course_name}
            </h2>

            <p
              className="mt-1 font-mono text-[13px]"
              style={{ color: colors.text.muted }}
            >
              {success.course_code}
            </p>

            <div
              className="my-6 border-t"
              style={{ borderColor: colors.surface[200] }}
            />

            <p
              className="mb-4 text-left text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.muted }}
            >
              What's next
            </p>

            <div className="space-y-3">
              <NextStep index={1}>
                Start a writing session to build your first evidence trail.
              </NextStep>
              <NextStep index={2}>
                Submit sessions to this course from the editor.
              </NextStep>
              <NextStep index={3}>
                Your teacher will review your behavioral evidence.
              </NextStep>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(ROUTES.EDITOR_NEW)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-bold transition hover:brightness-110"
                style={{ background: brand.action, color: brand.textOnDark }}
              >
                Start Writing Session
                <Icon type="arrowRight" size={14} />
              </button>

              <button
                type="button"
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="h-11 w-full rounded-md border text-[13px] font-semibold transition hover:brightness-95"
                style={{
                  background: brand.bgCard,
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Back to Dashboard
              </button>
            </div>

            <button
              type="button"
              onClick={resetEnrollment}
              className="mt-4 text-center text-[12px] font-semibold"
              style={{ color: colors.brand }}
            >
              Join another course
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
