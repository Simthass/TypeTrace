// src/pages/student/JoinCoursePage.tsx
// Student enters an invite code from their teacher to enrol in a course.
// Accessible from the student dashboard sidebar.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

export default function JoinCoursePage() {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    course_name: string;
    course_code: string;
  } | null>(null);
  const navigate = useNavigate();

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter an invite code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        message: string;
        course_name: string;
        course_code: string;
      }>("/courses/join", { invite_code: code });
      setSuccess({
        course_name: res.data.course_name,
        course_code: res.data.course_code,
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail ?? "Invalid invite code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-6">
      <div
        className="w-full max-w-[420px] bg-white rounded-2xl border p-8"
        style={{ borderColor: colors.surface[200] }}
      >
        {!success ? (
          <>
            <h1
              className="text-[20px] font-semibold mb-1"
              style={{ color: colors.text.primary }}
            >
              Join a Course
            </h1>
            <p
              className="text-[13px] mb-6"
              style={{ color: colors.text.secondary }}
            >
              Enter the invite code your instructor provided.
            </p>

            <input
              type="text"
              placeholder="e.g. TT-CS405-A3F1"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full px-4 py-3 rounded-xl text-[14px] font-mono font-bold tracking-widest outline-none mb-4"
              style={{
                border: `1px solid ${error ? "#fecaca" : colors.surface[200]}`,
                background: colors.surface[50],
                color: colors.text.primary,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0369a1";
                e.currentTarget.style.boxShadow = "0 0 0 1px #0369a1";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = error
                  ? "#fecaca"
                  : colors.surface[200];
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {error && (
              <div
                className="mb-4 px-3 py-2.5 rounded-lg text-[12px] font-medium"
                style={{ background: "#fef2f2", color: "#b91c1c" }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-opacity"
              style={{ background: "#0369a1", opacity: isLoading ? 0.7 : 1 }}
            >
              {isLoading ? "Joining..." : "Join Course"}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[20px]"
              style={{ background: "#f0fdf4" }}
            >
              ✓
            </div>
            <div>
              <p
                className="text-[16px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Enrolled!
              </p>
              <p
                className="text-[13px] mt-1"
                style={{ color: colors.text.secondary }}
              >
                You've joined <strong>{success.course_name}</strong> (
                {success.course_code}).
              </p>
            </div>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white mt-2"
              style={{ background: "#0369a1" }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
