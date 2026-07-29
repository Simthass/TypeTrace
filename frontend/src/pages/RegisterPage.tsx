import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthPanel,
  AuthSelect,
} from "../components/auth/AuthPanel";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import type { UserRole } from "../store/authStore";
import { useRegistrationStore } from "../store/registrationStore";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import { useToast } from "../components/ui/ToastContext";

interface RegisterResponse {
  message: string;
  registration_id: string;
  email: string;
  role: UserRole;
  expires_in_seconds: number;
}

interface RegisterForm {
  role: UserRole;
  first_name: string;
  last_name: string;
  student_id: string;
  email: string;
  university_name: string;
  department: string;
  password: string;
  confirm_password: string;
  consent: boolean;
}

const initialForm: RegisterForm = {
  role: "STUDENT",
  first_name: "",
  last_name: "",
  student_id: "",
  email: "",
  university_name: "",
  department: "",
  password: "",
  confirm_password: "",
  consent: false,
};

function validate(form: RegisterForm): string | null {
  if (!form.first_name.trim() || !form.last_name.trim()) {
    return "First name and last name are required.";
  }

  if (!form.email.trim()) {
    return "Email address is required.";
  }

  if (form.role === "STUDENT" && !form.student_id.trim()) {
    return "Student ID is required for student accounts.";
  }

  if (form.role === "TEACHER") {
    if (!form.university_name.trim() || !form.department.trim()) {
      return "University name and department are required for teacher accounts.";
    }
  }

  if (form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    return "Password must contain at least one letter and one number.";
  }

  if (form.password !== form.confirm_password) {
    return "Passwords do not match.";
  }

  if (!form.consent) {
    return "You must accept the data processing agreement to continue.";
  }

  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setRegistrationSession = useRegistrationStore(
    (state) => state.setSession,
  );
  const { showToast } = useToast();

  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const roleDescription = useMemo(() => {
    if (form.role === "TEACHER") {
      return "Create a teacher workspace to manage courses, review sessions, and audit writing evidence.";
    }

    return "Create a student workspace to capture writing sessions and generate authorship certificates.";
  }, [form.role]);

  const update = <K extends keyof RegisterForm>(
    key: K,
    value: RegisterForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setValidationError(null);

    const error = validate(form);
    if (error) {
      setValidationError(error);
      showToast({
        type: "warning",
        title: "Please check your information",
        message: error,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload =
        form.role === "TEACHER"
          ? {
              role: "TEACHER",
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              email: form.email.trim().toLowerCase(),
              university_name: form.university_name.trim(),
              department: form.department.trim(),
              password: form.password,
              consent: form.consent,
            }
          : {
              role: "STUDENT",
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              student_id: form.student_id.trim(),
              email: form.email.trim().toLowerCase(),
              university_name: form.university_name.trim() || null,
              password: form.password,
              consent: form.consent,
            };

      const response = await api.post<RegisterResponse>(
        API_ROUTES.auth.register,
        payload,
      );

      setRegistrationSession({
        registrationId: response.data.registration_id,
        email: response.data.email,
        role: response.data.role,
        expiresAt: Date.now() + response.data.expires_in_seconds * 1000,
      });

      showToast({
        type: "success",
        title: "OTP sent",
        message: "Check your email to complete TypeTrace registration.",
      });

      navigate(ROUTES.VERIFY_OTP, { replace: true });
    } catch (error) {
      showToast({
        type: "error",
        title: "Registration failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Create workspace"
      title="Start proving authorship from the first draft."
      description={roleDescription}
      sideTitle="Built for students and academic reviewers."
      sideDescription="Student accounts focus on writing evidence. Teacher accounts focus on course review, submission triage, and replayable audit trails."
    >
      <AuthForm onSubmit={submit}>
        {validationError && (
          <div
            className="rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.suspiciousAccent,
              background: brand.suspiciousBg,
              color: brand.suspiciousText,
            }}
          >
            {validationError}
          </div>
        )}

        <AuthSelect
          label="Account type"
          value={form.role}
          onChange={(event) => update("role", event.target.value as UserRole)}
        >
          <option value="STUDENT">Student</option>
          <option value="TEACHER">Teacher</option>
        </AuthSelect>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthField
            label="First name"
            value={form.first_name}
            onChange={(event) => update("first_name", event.target.value)}
            placeholder="Simthass"
          />

          <AuthField
            label="Last name"
            value={form.last_name}
            onChange={(event) => update("last_name", event.target.value)}
            placeholder="Mohammed"
          />
        </div>

        {form.role === "STUDENT" && (
          <AuthField
            label="Student ID"
            value={form.student_id}
            onChange={(event) => update("student_id", event.target.value)}
            placeholder="Your university student ID"
          />
        )}

        <AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="you@university.edu"
        />

        <AuthField
          label="University name"
          value={form.university_name}
          onChange={(event) => update("university_name", event.target.value)}
          placeholder={form.role === "TEACHER" ? "Required" : "Optional"}
        />

        {form.role === "TEACHER" && (
          <AuthField
            label="Department"
            value={form.department}
            onChange={(event) => update("department", event.target.value)}
            placeholder="Computer Science"
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="Minimum 8 characters"
          />

          <AuthField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirm_password}
            onChange={(event) => update("confirm_password", event.target.value)}
            placeholder="Repeat password"
          />
        </div>

        <label
          className="flex gap-3 rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => update("consent", event.target.checked)}
            className="mt-1 h-4 w-4"
            style={{ accentColor: colors.brand }}
          />

          <span
            className="text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            I agree that TypeTrace may process writing-session metadata for
            authorship verification and academic review workflows.
          </span>
        </label>

        <AuthButton isLoading={isSubmitting}>Create account</AuthButton>

        <p
          className="text-center text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          Already registered?{" "}
          <Link
            to={ROUTES.LOGIN}
            className="font-semibold"
            style={{ color: brand.action }}
          >
            Sign in
          </Link>
        </p>
      </AuthForm>
    </AuthPanel>
  );
}
