import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";
import { useAuthStore, type UserRole } from "../store/authStore";

// =============================================================================
// SCHEMAS
// =============================================================================

const studentSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  studentId: z
    .string()
    .min(5, "Valid Student ID required (min 5 digits)")
    .regex(/^\d+$/, "Student ID must be numeric"),
  email: z.string().email("Invalid university email"),
  universityName: z.string().optional(),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .regex(/\d/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Biometric consent is required to proceed." }),
  }),
});

const teacherSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid institutional email"),
  universityName: z
    .string()
    .min(2, "University / Institution name is required"),
  department: z.string().min(2, "Department is required"),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .regex(/\d/, "Must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must accept the data processing agreement.",
    }),
  }),
});

type StudentFormValues = z.infer<typeof studentSchema>;
type TeacherFormValues = z.infer<typeof teacherSchema>;

// =============================================================================
// ICONS
// =============================================================================

function StudentIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function TeacherIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// =============================================================================
// SHARED FIELD COMPONENT
// =============================================================================

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[13px] font-medium"
        style={{ color: colors.text.primary }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span className="text-xs font-medium" style={{ color: brand.aiAccent }}>
          {error}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// STEP 1: ROLE SELECTOR
// =============================================================================

function RoleSelector({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-[420px]"
    >
      <div className="flex flex-col items-center mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight mb-2 text-center"
          style={{ color: colors.text.primary }}
        >
          Create your account
        </h1>
        <p
          className="text-[15px] text-center"
          style={{ color: colors.text.secondary }}
        >
          How will you be using TypeTrace?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Student card */}
        <button
          onClick={() => onSelect("STUDENT")}
          className="group w-full flex items-center gap-5 p-5 rounded-xl border-2 text-left transition-all duration-200"
          style={{
            backgroundColor: colors.surface[50],
            borderColor: colors.surface[200],
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = brand.action;
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.surface[200];
            e.currentTarget.style.backgroundColor = colors.surface[50];
          }}
        >
          <div
            className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
            style={{
              backgroundColor: `${brand.action}12`,
              color: brand.action,
            }}
          >
            <StudentIcon />
          </div>
          <div className="flex-1">
            <div
              className="text-[15px] font-semibold mb-0.5"
              style={{ color: colors.text.primary }}
            >
              I'm a Student
            </div>
            <div
              className="text-[13px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              Write essays, generate behavioral certificates, replay your
              sessions.
            </div>
          </div>
          <ChevronRight />
        </button>

        {/* Teacher card */}
        <button
          onClick={() => onSelect("TEACHER")}
          className="group w-full flex items-center gap-5 p-5 rounded-xl border-2 text-left transition-all duration-200"
          style={{
            backgroundColor: colors.surface[50],
            borderColor: colors.surface[200],
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = brand.action;
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.surface[200];
            e.currentTarget.style.backgroundColor = colors.surface[50];
          }}
        >
          <div
            className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ backgroundColor: "#f0f9ff", color: "#0369a1" }}
          >
            <TeacherIcon />
          </div>
          <div className="flex-1">
            <div
              className="text-[15px] font-semibold mb-0.5"
              style={{ color: colors.text.primary }}
            >
              I'm a Teacher / Instructor
            </div>
            <div
              className="text-[13px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              Create courses, review student submissions, run behavioral audits.
            </div>
          </div>
          <ChevronRight />
        </button>
      </div>

      <p
        className="text-sm text-center mt-8"
        style={{ color: colors.text.secondary }}
      >
        Already have an account?{" "}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium hover:underline"
          style={{ color: colors.text.primary }}
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

// =============================================================================
// STEP 2A: STUDENT FORM
// =============================================================================

function StudentForm({ onBack }: { onBack: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setPendingEmail = useAuthStore((state) => state.setPendingEmail);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFormValues>({ resolver: zodResolver(studentSchema) });

  const getInputStyle = (
    field: string,
    hasError: boolean,
  ): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    backgroundColor: colors.surface[50],
    borderRadius: "8px",
    fontSize: "14px",
    color: colors.text.primary,
    outline: "none",
    transition: "all 0.15s ease",
    border: `1px solid ${
      hasError
        ? brand.aiAccent
        : focusedField === field
          ? brand.action
          : colors.surface[200]
    }`,
    boxShadow:
      focusedField === field && !hasError
        ? `0 0 0 1px ${brand.action}`
        : "none",
  });

  const onSubmit = async (data: StudentFormValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await api.post("/auth/register", {
        role: "STUDENT",
        first_name: data.firstName,
        last_name: data.lastName,
        student_id: data.studentId,
        email: data.email,
        university_name: data.universityName ?? null,
        password: data.password,
        consent: data.consent,
      });
      setPendingEmail(data.email);
      navigate(ROUTES.VERIFY_OTP);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setApiError(
        axiosErr.response?.data?.detail ??
          "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-[420px]"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] transition-colors mb-8"
        style={{ color: colors.text.secondary }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = colors.text.primary)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = colors.text.secondary)
        }
      >
        <BackIcon />
        Back
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: `${brand.action}12`, color: brand.action }}
        >
          <StudentIcon />
        </div>
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            Student Registration
          </h1>
          <p className="text-[13px]" style={{ color: colors.text.secondary }}>
            Create your academic authorship account
          </p>
        </div>
      </div>

      {apiError && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" error={errors.firstName?.message}>
            <input
              type="text"
              placeholder="Ada"
              {...register("firstName")}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle("firstName", !!errors.firstName)}
            />
          </Field>
          <Field label="Last Name" error={errors.lastName?.message}>
            <input
              type="text"
              placeholder="Lovelace"
              {...register("lastName")}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle("lastName", !!errors.lastName)}
            />
          </Field>
        </div>

        <Field label="Student ID" error={errors.studentId?.message}>
          <input
            type="text"
            placeholder="e.g. 2540927"
            {...register("studentId")}
            onFocus={() => setFocusedField("studentId")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("studentId", !!errors.studentId)}
          />
        </Field>

        <Field label="University Email" error={errors.email?.message}>
          <input
            type="email"
            placeholder="student@uni.ac.uk"
            {...register("email")}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("email", !!errors.email)}
          />
        </Field>

        <Field label="University Name (optional)">
          <input
            type="text"
            placeholder="e.g. University of Bedfordshire"
            {...register("universityName")}
            onFocus={() => setFocusedField("universityName")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("universityName", false)}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <input
            type="password"
            placeholder="••••••••"
            {...register("password")}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("password", !!errors.password)}
          />
        </Field>

        {/* Biometric consent */}
        <div
          className="flex items-start gap-3 p-4 rounded-lg"
          style={{
            backgroundColor: colors.surface[50],
            border: `1px solid ${errors.consent ? brand.aiAccent : colors.surface[200]}`,
          }}
        >
          <input
            type="checkbox"
            id="student-consent"
            {...register("consent")}
            className="mt-0.5 w-4 h-4 cursor-pointer"
            style={{ accentColor: brand.action }}
          />
          <label
            htmlFor="student-consent"
            className="text-[13px] leading-[1.5] cursor-pointer"
            style={{ color: colors.text.secondary }}
          >
            <strong
              className="block mb-1"
              style={{ color: colors.text.primary }}
            >
              Biometric Data Consent
            </strong>
            I agree to allow TypeTrace to securely record my keystroke timings
            solely for cryptographic authorship verification.
          </label>
        </div>
        {errors.consent && (
          <span
            className="text-xs font-medium"
            style={{ color: brand.aiAccent }}
          >
            {errors.consent.message}
          </span>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: brand.action,
            opacity: isLoading ? 0.8 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Creating account..." : "Create Student Account"}
        </button>
      </form>
    </motion.div>
  );
}

// =============================================================================
// STEP 2B: TEACHER FORM
// =============================================================================

function TeacherForm({ onBack }: { onBack: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setPendingEmail = useAuthStore((state) => state.setPendingEmail);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherFormValues>({ resolver: zodResolver(teacherSchema) });

  const getInputStyle = (
    field: string,
    hasError: boolean,
  ): React.CSSProperties => ({
    width: "100%",
    padding: "12px 14px",
    backgroundColor: colors.surface[50],
    borderRadius: "8px",
    fontSize: "14px",
    color: colors.text.primary,
    outline: "none",
    transition: "all 0.15s ease",
    border: `1px solid ${
      hasError
        ? brand.aiAccent
        : focusedField === field
          ? brand.action
          : colors.surface[200]
    }`,
    boxShadow:
      focusedField === field && !hasError
        ? `0 0 0 1px ${brand.action}`
        : "none",
  });

  const onSubmit = async (data: TeacherFormValues) => {
    setIsLoading(true);
    setApiError(null);
    try {
      await api.post("/auth/register", {
        role: "TEACHER",
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        university_name: data.universityName,
        department: data.department,
        password: data.password,
        consent: data.consent,
      });
      setPendingEmail(data.email);
      navigate(ROUTES.VERIFY_OTP);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setApiError(
        axiosErr.response?.data?.detail ??
          "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-[420px]"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] transition-colors mb-8"
        style={{ color: colors.text.secondary }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = colors.text.primary)
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = colors.text.secondary)
        }
      >
        <BackIcon />
        Back
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: "#f0f9ff", color: "#0369a1" }}
        >
          <TeacherIcon />
        </div>
        <div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            Instructor Registration
          </h1>
          <p className="text-[13px]" style={{ color: colors.text.secondary }}>
            Create your academic oversight account
          </p>
        </div>
      </div>

      {apiError && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" error={errors.firstName?.message}>
            <input
              type="text"
              placeholder="James"
              {...register("firstName")}
              onFocus={() => setFocusedField("firstName")}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle("firstName", !!errors.firstName)}
            />
          </Field>
          <Field label="Last Name" error={errors.lastName?.message}>
            <input
              type="text"
              placeholder="Turing"
              {...register("lastName")}
              onFocus={() => setFocusedField("lastName")}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle("lastName", !!errors.lastName)}
            />
          </Field>
        </div>

        <Field label="Institutional Email" error={errors.email?.message}>
          <input
            type="email"
            placeholder="j.turing@university.ac.uk"
            {...register("email")}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("email", !!errors.email)}
          />
        </Field>

        <Field
          label="University / Institution"
          error={errors.universityName?.message}
        >
          <input
            type="text"
            placeholder="e.g. University of Bedfordshire"
            {...register("universityName")}
            onFocus={() => setFocusedField("universityName")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("universityName", !!errors.universityName)}
          />
        </Field>

        <Field label="Department" error={errors.department?.message}>
          <input
            type="text"
            placeholder="e.g. Computer Science"
            {...register("department")}
            onFocus={() => setFocusedField("department")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("department", !!errors.department)}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <input
            type="password"
            placeholder="••••••••"
            {...register("password")}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            style={getInputStyle("password", !!errors.password)}
          />
        </Field>

        {/* Data processing agreement */}
        <div
          className="flex items-start gap-3 p-4 rounded-lg"
          style={{
            backgroundColor: colors.surface[50],
            border: `1px solid ${errors.consent ? brand.aiAccent : colors.surface[200]}`,
          }}
        >
          <input
            type="checkbox"
            id="teacher-consent"
            {...register("consent")}
            className="mt-0.5 w-4 h-4 cursor-pointer"
            style={{ accentColor: "#0369a1" }}
          />
          <label
            htmlFor="teacher-consent"
            className="text-[13px] leading-[1.5] cursor-pointer"
            style={{ color: colors.text.secondary }}
          >
            <strong
              className="block mb-1"
              style={{ color: colors.text.primary }}
            >
              Data Processing Agreement
            </strong>
            I confirm I have the authority to review student behavioral data at
            my institution and agree to TypeTrace's academic data processing
            terms.
          </label>
        </div>
        {errors.consent && (
          <span
            className="text-xs font-medium"
            style={{ color: brand.aiAccent }}
          >
            {errors.consent.message}
          </span>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: "#0369a1",
            opacity: isLoading ? 0.8 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Creating account..." : "Create Instructor Account"}
        </button>
      </form>
    </motion.div>
  );
}

// =============================================================================
// PAGE ROOT
// =============================================================================

type Step = "select" | "student" | "teacher";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("select");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    setStep(role === "TEACHER" ? "teacher" : "student");
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ backgroundColor: colors.text.light }}
    >
      {/* Header */}
      <header
        className="w-full flex items-center justify-between px-12 shrink-0"
        style={{ height: 64, borderColor: colors.surface[200] }}
      >
        <Link to={ROUTES.HOME} aria-label="Back to Home">
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-[30px] w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </Link>
        <Link
          to={ROUTES.LOGIN}
          className="px-6 py-2 rounded-md text-[13px] font-semibold border transition-colors"
          style={{
            color: colors.text.primary,
            borderColor: colors.surface[200],
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = colors.surface[50])
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          Sign In
        </Link>
      </header>

      {/* Form area */}
      <div className="flex-1 flex items-start justify-center pt-[8vh] px-6 pb-10">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <RoleSelector key="select" onSelect={handleRoleSelect} />
          )}
          {step === "student" && (
            <StudentForm key="student" onBack={() => setStep("select")} />
          )}
          {step === "teacher" && (
            <TeacherForm key="teacher" onBack={() => setStep("select")} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
