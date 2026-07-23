export type AuthRole = "STUDENT" | "TEACHER";

export const FRONTEND_URL =
  process.env.E2E_FRONTEND_URL || "http://127.0.0.1:5173";

export const BACKEND_URL =
  process.env.E2E_BACKEND_URL || "http://127.0.0.1:8000";

export const STUDENT_AUTH_STATE = "playwright/.auth/student.json";
export const TEACHER_AUTH_STATE = "playwright/.auth/teacher.json";

export function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `${name} is required. Copy frontend/.env.e2e.example to ` +
        "frontend/.env.e2e and provide a dedicated test value.",
    );
  }

  return value;
}

export function optionalEnv(name: string): string | null {
  const value = String(process.env[name] || "").trim();
  return value || null;
}

export function booleanEnv(name: string, defaultValue = false): boolean {
  const value = String(process.env[name] || "").trim().toLowerCase();

  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}
