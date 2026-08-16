import { describe, expect, it } from "vitest";

import { API_ROUTES } from "../constants/apiRoutes";
import { PAGE_METADATA_ROUTES } from "../constants/pageMetadata";
import { ROUTES } from "../constants/routes";

describe("routing metadata coverage", () => {
  it("builds every dynamic API route with encoded identifiers where required", () => {
    expect(API_ROUTES.auth.registrationStatus("reg a/b")).toBe(
      "/auth/pending-registration/reg%20a%2Fb",
    );
    expect(API_ROUTES.auth.cancelRegistration("reg a/b")).toBe(
      "/auth/pending-registration/reg%20a%2Fb",
    );
    expect(API_ROUTES.auth.passwordResetStatus("rst a/b")).toBe(
      "/auth/password-reset/rst%20a%2Fb",
    );
    expect(API_ROUTES.auth.cancelPasswordReset("rst a/b")).toBe(
      "/auth/password-reset/rst%20a%2Fb",
    );
    expect(API_ROUTES.student.sessionDetail(42)).toBe("/student/sessions/42");
    expect(API_ROUTES.drafts.detail("draft a/b")).toBe("/drafts/draft%20a%2Fb");
    expect(API_ROUTES.drafts.submit("draft a/b")).toBe(
      "/drafts/draft%20a%2Fb/submit",
    );
    expect(API_ROUTES.sessions.replay("S-1")).toBe("/sessions/S-1/replay");
    expect(API_ROUTES.sessions.certificateData("S-1")).toBe(
      "/sessions/S-1/certificate-data",
    );
    expect(API_ROUTES.replay.detail("S-1")).toBe("/replay/S-1");
    expect(API_ROUTES.certificates.detail("TT-1")).toBe("/certificates/TT-1");
    expect(API_ROUTES.certificates.pdf("TT-1")).toBe("/certificates/TT-1/pdf");
    expect(API_ROUTES.certificates.verifyPublic("TT-1")).toBe("/verify/TT-1");
    expect(API_ROUTES.certificates.revoke("TT-1")).toBe(
      "/certificates/TT-1/revoke",
    );
    expect(API_ROUTES.verify.publicCertificate("TT-1")).toBe("/verify/TT-1");
    expect(API_ROUTES.teacher.courseDetail(7)).toBe("/teacher/courses/7");
    expect(API_ROUTES.teacher.sessionDetail(9)).toBe("/teacher/sessions/9");
    expect(API_ROUTES.teacher.sessionReview(9)).toBe("/teacher/sessions/9/review");
    expect(API_ROUTES.notifications.markRead("notice-1")).toBe(
      "/notifications/notice-1/read",
    );
  });

  it("keeps static API endpoints available across each application domain", () => {
    const staticRoutes = [
      API_ROUTES.health.check,
      API_ROUTES.auth.register,
      API_ROUTES.auth.login,
      API_ROUTES.auth.me,
      API_ROUTES.auth.verifyToken,
      API_ROUTES.auth.logout,
      API_ROUTES.auth.verifyOtp,
      API_ROUTES.auth.resendOtp,
      API_ROUTES.auth.passwordResetRequest,
      API_ROUTES.auth.passwordResetVerify,
      API_ROUTES.auth.passwordResetConfirm,
      API_ROUTES.student.dashboard,
      API_ROUTES.student.analytics,
      API_ROUTES.student.sessions,
      API_ROUTES.drafts.list,
      API_ROUTES.sessions.analyze,
      API_ROUTES.certificates.list,
      API_ROUTES.user.profile,
      API_ROUTES.user.changePassword,
      API_ROUTES.user.dataExport,
      API_ROUTES.user.sensitiveDataExport,
      API_ROUTES.user.account,
      API_ROUTES.teacher.dashboard,
      API_ROUTES.teacher.courses,
      API_ROUTES.teacher.students,
      API_ROUTES.teacher.sessions,
      API_ROUTES.courses.join,
      API_ROUTES.courses.enrolled,
      API_ROUTES.model.status,
      API_ROUTES.model.metrics,
      API_ROUTES.model.features,
      API_ROUTES.model.reload,
      API_ROUTES.notifications.list,
      API_ROUTES.notifications.unreadCount,
      API_ROUTES.notifications.markAllRead,
    ];

    expect(staticRoutes.every((route) => route.startsWith("/"))).toBe(true);
    expect(new Set(staticRoutes).size).toBeGreaterThan(25);
  });

  it("evaluates every page title and description callback with and without route parameters", () => {
    const params = {
      certId: "TT-ABCDEFGHIJKL",
      sessionId: "157",
      courseId: "5",
    };

    for (const metadata of PAGE_METADATA_ROUTES) {
      const title =
        typeof metadata.title === "function"
          ? metadata.title(params)
          : metadata.title;
      const description =
        typeof metadata.description === "function"
          ? metadata.description(params)
          : metadata.description;

      expect(title.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(10);

      if (typeof metadata.title === "function") {
        expect(metadata.title({}).length).toBeGreaterThan(0);
      }
      if (typeof metadata.description === "function") {
        expect(metadata.description({}).length).toBeGreaterThan(10);
      }
    }
  });

  it("contains metadata for the principal public, student, and teacher routes", () => {
    const paths = new Set(PAGE_METADATA_ROUTES.map((entry) => entry.path));
    for (const path of [
      ROUTES.HOME,
      ROUTES.VERIFY,
      ROUTES.LOGIN,
      ROUTES.FORGOT_PASSWORD,
      ROUTES.DASHBOARD,
      ROUTES.EDITOR,
      ROUTES.SESSIONS,
      ROUTES.CERTIFICATES,
      ROUTES.TEACHER_DASHBOARD,
      ROUTES.TEACHER_COURSES,
      ROUTES.TEACHER_REVIEW,
      ROUTES.NOT_FOUND,
    ]) {
      expect(paths.has(path)).toBe(true);
    }
  });
});
