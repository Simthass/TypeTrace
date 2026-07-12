// frontend/src/pages/student/JoinCoursePage.tsx

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { api, getApiErrorMessage } from "../../lib/api";
import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { useToast } from "../../components/ui/ToastProvider";
import { brand, colors } from "../../styles/colors";
import { Button } from "../../components/ui/Button";

export default function JoinCoursePage() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setError("Please enter a valid invite code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Matches the expected payload for app/api/routes/courses.py
      const response = await api.post(API_ROUTES.courses.join, {
        invite_code: cleanCode,
      });

      showToast({
        type: "success",
        title: "Course joined successfully",
        message: `You are now enrolled in ${response.data.course.course_name}.`,
      });

      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center py-10">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div
          className="relative overflow-hidden rounded-xl border bg-white px-8 py-10 text-center"
          style={{
            borderColor: colors.surface[200],
            boxShadow: `0 24px 60px -12px ${colors.shadowStrong}`,
          }}
        >
          {/* Subtle background glow effect */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${colors.brandSoft} 0%, transparent 70%)`,
              filter: "blur(24px)",
            }}
          />

          <div
            className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-xl border"
            style={{
              background: colors.brandSoft,
              borderColor: colors.surface[200],
              color: colors.brand,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
            </svg>
          </div>

          <h1
            className="relative mt-6 text-2xl font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            Join a Course
          </h1>

          <p
            className="relative mx-auto mt-2 text-[14px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Enter the instructor-provided invite code to link your writing
            evidence to an academic module.
          </p>

          <form onSubmit={handleSubmit} className="relative mt-8">
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setError(null);
                    // Force uppercase and remove spaces for a clean SaaS feel
                    setCode(e.target.value.toUpperCase().replace(/\s/g, ""));
                  }}
                  placeholder="TT-XXXXXXXX"
                  className="w-full rounded-lg border-2 bg-transparent px-4 py-4 text-center font-mono text-xl font-bold tracking-[0.15em] outline-none transition-colors focus:ring-0"
                  style={{
                    borderColor: error ? brand.aiAccent : colors.surface[200],
                    color: colors.text.primary,
                  }}
                  autoFocus
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="text-[13px] font-medium"
                  style={{ color: brand.aiText }}
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="h-12 w-full text-[14px]"
                disabled={!code.trim() || isSubmitting}
              >
                {isSubmitting ? "Verifying code..." : "Join course"}
              </Button>
            </div>
          </form>

          <div
            className="relative mt-8 border-t pt-6"
            style={{ borderColor: colors.surface[200] }}
          >
            <p className="text-[12px]" style={{ color: colors.text.muted }}>
              Don't have an invite code? Ask your instructor or return to the{" "}
              <button
                type="button"
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: colors.text.primary }}
              >
                dashboard
              </button>
              .
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
