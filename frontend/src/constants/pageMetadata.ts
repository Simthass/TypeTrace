import { ROUTES } from "./routes";
import { shortId } from "../lib/documentMetadata";

export type PageParams = Record<string, string | undefined>;

export interface PageMetadataRoute {
  path: string;
  title: string | ((params: PageParams) => string);
  description: string | ((params: PageParams) => string);
}

export const PAGE_METADATA_ROUTES: PageMetadataRoute[] = [
  {
    path: ROUTES.HOME,
    title: "TypeTrace · Academic Authorship Verification",
    description:
      "TypeTrace captures keystroke dynamics, revision behavior, pause timing, and cryptographic evidence so students can prove how their work was written.",
  },
  {
    path: ROUTES.HOW_IT_WORKS,
    title: "How TypeTrace Works",
    description:
      "See how TypeTrace captures writing-process evidence, analyzes keystroke behavior, and produces verifiable academic authorship certificates.",
  },
  {
    path: ROUTES.FEATURES,
    title: "Features",
    description:
      "Explore TypeTrace writing sessions, behavioral analysis, teacher review workflows, replay evidence, and public certificate verification.",
  },
  {
    path: ROUTES.ABOUT,
    title: "About",
    description:
      "Learn why TypeTrace focuses on writing-process evidence instead of final-text guessing for academic integrity review.",
  },

  {
    path: ROUTES.PRIVACY,
    title: "Privacy and Evidence Handling",
    description:
      "Understand what TypeTrace captures, what public verification exposes, and how behavioral evidence is handled for academic review.",
  },
  {
    path: ROUTES.HELP_DOCS,
    title: "Help Documentation",
    description:
      "Read TypeTrace guidance for writing sessions, certificates, replay evidence, verification, and account workflows.",
  },
  {
    path: ROUTES.VERIFY_LOOKUP,
    title: "Verify Certificate",
    description:
      "Enter a TypeTrace certificate ID to check whether an academic authorship certificate exists in the public verification ledger.",
  },
  {
    path: ROUTES.VERIFY,
    title: ({ certId }) =>
      certId ? `Certificate ${shortId(certId)}` : "Certificate Result",
    description: ({ certId }) =>
      certId
        ? `View the public TypeTrace verification result for certificate ${certId}.`
        : "View a public TypeTrace certificate verification result.",
  },
  {
    path: ROUTES.LOGIN,
    title: "Sign In",
    description:
      "Sign in to TypeTrace to access your writing evidence workspace, sessions, certificates, replay trails, and account settings.",
  },
  {
    path: ROUTES.REGISTER,
    title: "Create Account",
    description:
      "Create a TypeTrace student or teacher account to start capturing and reviewing academic authorship evidence.",
  },
  {
    path: ROUTES.VERIFY_OTP,
    title: "Verify Account",
    description:
      "Confirm your TypeTrace account using the verification code sent to your email address.",
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    title: "Reset Password",
    description:
      "Recover access to your TypeTrace account with a secure email verification flow.",
  },
  {
    path: ROUTES.SETTINGS,
    title: "Settings",
    description:
      "Manage your TypeTrace account settings, password, data export, and privacy controls.",
  },
  {
    path: ROUTES.STUDENT_SETTINGS,
    title: "Student Settings",
    description:
      "Manage your TypeTrace student profile, security settings, data export, and account controls.",
  },
  {
    path: ROUTES.TEACHER_SETTINGS,
    title: "Teacher Settings",
    description:
      "Manage your TypeTrace teacher profile, security settings, data export, and account controls.",
  },
  {
    path: ROUTES.REPLAY,
    title: ({ sessionId }) =>
      sessionId ? `Session Replay ${shortId(sessionId)}` : "Session Replay",
    description:
      "Replay a TypeTrace writing session timeline with keystrokes, pauses, paste activity, deletions, and behavioral evidence markers.",
  },
  {
    path: ROUTES.EDITOR_NEW,
    title: "New Writing Session",
    description:
      "Start a TypeTrace writing session and capture keystroke dynamics, revisions, pauses, and evidence for authorship review.",
  },
  {
    path: ROUTES.EDITOR,
    title: "Writing Editor",
    description:
      "Write inside the TypeTrace editor while behavioral authorship evidence is captured in the background.",
  },
  {
    path: ROUTES.DASHBOARD,
    title: "Student Dashboard",
    description:
      "Review your TypeTrace sessions, certificate activity, writing evidence metrics, and academic authorship status.",
  },
  {
    path: ROUTES.DRAFTS,
    title: "Drafts",
    description:
      "Resume unfinished TypeTrace writing drafts with text, keystroke evidence, timing state, and course selection preserved.",
  },
  {
    path: ROUTES.SESSIONS,
    title: "Sessions",
    description:
      "Browse and review your TypeTrace writing sessions, analysis results, certificates, and replay-ready evidence trails.",
  },
  {
    path: ROUTES.CERTIFICATES,
    title: "Certificates",
    description:
      "View and download your TypeTrace authorship certificates and public verification links.",
  },
  {
    path: ROUTES.ANALYTICS,
    title: "Analytics",
    description:
      "Review your TypeTrace writing behavior analytics, evidence trends, certificate outcomes, and session metrics.",
  },
  {
    path: ROUTES.JOIN_COURSE,
    title: "Join Course",
    description:
      "Join a TypeTrace course using an instructor invite code and attach writing evidence to teacher review workflows.",
  },
  {
    path: ROUTES.TEACHER_DASHBOARD,
    title: "Teacher Dashboard",
    description:
      "Review TypeTrace course activity, student evidence submissions, certificates, and academic integrity cases.",
  },
  {
    path: ROUTES.TEACHER_COURSES,
    title: "Courses",
    description:
      "Manage TypeTrace courses, invite codes, enrolled students, and course-linked writing evidence.",
  },
  {
    path: ROUTES.TEACHER_COURSE_DETAIL,
    title: ({ courseId }) =>
      courseId ? `Course ${shortId(courseId)}` : "Course Detail",
    description:
      "Review a TypeTrace course workspace with enrolled students, submissions, certificates, and teacher evidence tools.",
  },
  {
    path: ROUTES.TEACHER_SUBMISSIONS,
    title: "Submissions",
    description:
      "Review TypeTrace student submissions with behavioral evidence, certificates, replay trails, and course context.",
  },
  {
    path: ROUTES.TEACHER_STUDENTS,
    title: "Students",
    description:
      "Review enrolled students, course activity, and writing evidence status across TypeTrace teacher workflows.",
  },
  {
    path: ROUTES.TEACHER_REVIEW,
    title: ({ sessionId }) =>
      sessionId ? `Review Session ${shortId(sessionId)}` : "Review Session",
    description:
      "Review a TypeTrace writing session with behavioral metrics, replay evidence, classification output, and certificate metadata.",
  },

  {
    path: ROUTES.TEACHER_MODEL_STATUS,
    title: "Model Status",
    description:
      "Review the active TypeTrace Isolation Forest model status, metrics, feature schema, and operational readiness.",
  },
  {
    path: ROUTES.NOT_FOUND,
    title: "Page Not Found",
    description:
      "The requested TypeTrace page could not be found. Return to the correct dashboard, verification page, or public site.",
  },
];
