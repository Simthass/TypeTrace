export const API_ROUTES = {
  health: {
    check: "/health",
  },

  auth: {
    register: "/auth/register",
    login: "/auth/login",
    me: "/auth/me",
    verifyToken: "/auth/verify-token",
    logout: "/auth/logout",
    verifyOtp: "/auth/verify-otp",
    resendOtp: "/auth/resend-otp",
    passwordResetRequest: "/auth/password-reset/request",
    passwordResetVerify: "/auth/password-reset/verify",
    passwordResetConfirm: "/auth/password-reset/confirm",
  },

  student: {
    dashboard: "/student/dashboard",
    analytics: "/student/analytics",
    sessions: "/student/sessions",
  },

  drafts: {
    list: "/drafts",
    detail: (draftId: string) => `/drafts/${encodeURIComponent(draftId)}`,
    submit: (draftId: string) =>
      `/drafts/${encodeURIComponent(draftId)}/submit`,
  },

  sessions: {
    analyze: "/sessions/analyze",
    replay: (sessionId: string | number) => `/sessions/${sessionId}/replay`,
    certificateData: (sessionId: string | number) =>
      `/sessions/${sessionId}/certificate-data`,
  },

  replay: {
    detail: (sessionId: string | number) => `/replay/${sessionId}`,
  },

  certificates: {
    list: "/certificates",
    detail: (certificateId: string) => `/certificates/${certificateId}`,
    pdf: (certificateId: string) => `/certificates/${certificateId}/pdf`,
    verifyPublic: (certificateId: string) => `/verify/${certificateId}`,
    revoke: (certificateId: string) => `/certificates/${certificateId}/revoke`,
  },

  verify: {
    publicCertificate: (certificateId: string) => `/verify/${certificateId}`,
  },

  user: {
    profile: "/user/profile",
    changePassword: "/user/change-password",
    dataExport: "/user/data-export",
    account: "/user/account",
  },

  teacher: {
    dashboard: "/teacher/dashboard",
    courses: "/teacher/courses",
    courseDetail: (courseId: string | number) => `/teacher/courses/${courseId}`,
    students: "/teacher/students",
    sessions: "/teacher/sessions",
    sessionDetail: (sessionId: string | number) =>
      `/teacher/sessions/${sessionId}`,
    sessionReview: (sessionId: string | number) =>
      `/teacher/sessions/${sessionId}/review`,
  },

  courses: {
    join: "/courses/join",
    enrolled: "/courses/enrolled",
  },

  model: {
    status: "/model/status",
    reload: "/model/reload",
  },
} as const;
