import { Link } from "react-router-dom";
import { brand, colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─── Icons ───────────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function ShieldCheck() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 1.5L2 3.5v3c0 2.8 1.95 5.1 4.5 5.8C9.05 11.6 11 9.3 11 6.5v-3L6.5 1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 6.5l1.5 1.5 2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Footer column data ───────────────────────────────────────────────────────

const FOOTER_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
      { label: "Features", path: ROUTES.FEATURES },
      { label: "Student Dashboard", path: ROUTES.DASHBOARD },
      { label: "Teacher Console", path: ROUTES.TEACHER_DASHBOARD },
      { label: "Writing Sessions", path: ROUTES.SESSIONS },
    ],
  },
  {
    heading: "Verification",
    links: [
      { label: "Certificate Lookup", path: ROUTES.VERIFY_LOOKUP },
      { label: "Session Replay", path: ROUTES.SESSIONS },
      { label: "Certificates", path: ROUTES.CERTIFICATES },
      { label: "Analytics", path: ROUTES.ANALYTICS },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About TypeTrace", path: ROUTES.ABOUT },
      { label: "Help & Docs", path: ROUTES.HELP_DOCS },
      { label: "Privacy & GDPR", path: ROUTES.PRIVACY },
      { label: "Academic Research", path: ROUTES.ABOUT },
    ],
  },
] as const;

const SOCIAL = [
  { label: "GitHub", href: "https://github.com", Icon: GitHubIcon },
  { label: "X / Twitter", href: "https://twitter.com", Icon: TwitterIcon },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedInIcon },
] as const;

// ─── Trust badges ─────────────────────────────────────────────────────────────

const TRUST_BADGES = [
  {
    label: "GDPR Compliant",
    color: colors.text.secondary,
    bg: colors.surface[100],
    border: colors.surface[200],
  },
  {
    label: "WCAG 2.1 AA",
    color: colors.text.secondary,
    bg: colors.surface[100],
    border: colors.surface[200],
  },
  {
    label: "SHA-256 Sealed",
    color: brand.humanText,
    bg: brand.humanBg,
    border: brand.humanAccent,
  },
] as const;

// ─── Stat items ───────────────────────────────────────────────────────────────

const STATS = [
  { value: "96.3%", label: "Model accuracy" },
  { value: "<5%", label: "False positive target" },
  { value: "3", label: "Evidence layers" },
] as const;

// ─── Footer link component ────────────────────────────────────────────────────

function FooterLink({ label, path }: { label: string; path: string }) {
  return (
    <Link
      to={path}
      style={{
        fontSize: 13.5,
        fontWeight: 400,
        color: colors.text.secondary,
        textDecoration: "none",
        transition: "color 0.15s ease",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = colors.text.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = colors.text.secondary;
      }}
    >
      {label}
    </Link>
  );
}

// ─── Main Footer export ───────────────────────────────────────────────────────

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      style={{
        backgroundColor: colors.surface[50],
        borderTop: `1px solid ${colors.surface[200]}`,
        fontFamily: "inherit",
      }}
    >
      {/* ── Top CTA band ── */}
      <div
        style={{
          borderBottom: `1px solid ${colors.surface[200]}`,
          backgroundColor: colors.surface[100],
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "40px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: colors.brand,
              }}
            >
              Behavioral authorship verification
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(18px, 2.4vw, 24px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: colors.text.primary,
                lineHeight: 1.2,
              }}
            >
              Prove authorship before doubt begins.
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13.5,
                color: colors.text.secondary,
                lineHeight: 1.6,
              }}
            >
              TypeTrace captures how you type, not just what you type. Generate
              verifiable authorship evidence with every session.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <Link
              to={ROUTES.REGISTER}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 20px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: colors.text.light,
                backgroundColor: colors.brand,
                textDecoration: "none",
                transition: "background-color 0.13s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.brandHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.brand;
              }}
            >
              Start free session
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 6h7M6.5 2.5l3.5 3.5-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                letterSpacing: "-0.012em",
                color: colors.text.secondary,
                backgroundColor: "transparent",
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                transition: "all 0.13s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.text.primary;
                e.currentTarget.style.borderColor = colors.surface[300];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.text.secondary;
                e.currentTarget.style.borderColor = colors.surface[200];
              }}
            >
              Verify a certificate
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 32px 48px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "32px 48px",
          }}
          className="tt-footer-grid"
        >
          {/* ── Brand column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Logo */}
            <Link
              to={ROUTES.HOME}
              aria-label="TypeTrace Home"
              style={{
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                width: "fit-content",
              }}
            >
              <img
                src="/Logo.png"
                alt="TypeTrace"
                style={{
                  height: 30,
                  width: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </Link>

            {/* Tagline */}
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.7,
                color: colors.text.secondary,
                maxWidth: 240,
              }}
            >
              Behavioral keystroke biometrics that protect honest students in
              the generative AI era.
            </p>

            {/* Stats mini-grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: "-0.025em",
                      color: colors.text.primary,
                      minWidth: 48,
                    }}
                  >
                    {stat.value}
                  </span>
                  <span style={{ fontSize: 12, color: colors.text.secondary }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              {SOCIAL.map(({ label, href, Icon: SocialIcon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    display: "flex",
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.text.secondary,
                    backgroundColor: colors.surface[100],
                    border: `1px solid ${colors.surface[200]}`,
                    transition: "all 0.13s ease",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.brand;
                    e.currentTarget.style.borderColor = colors.surface[300];
                    e.currentTarget.style.backgroundColor = colors.brandSoft;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.text.secondary;
                    e.currentTarget.style.borderColor = colors.surface[200];
                    e.currentTarget.style.backgroundColor = colors.surface[100];
                  }}
                >
                  <SocialIcon />
                </a>
              ))}
            </div>
          </div>

          {/* ── Link columns ── */}
          {FOOTER_COLUMNS.map((col) => (
            <div
              key={col.heading}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: colors.text.primary,
                }}
              >
                {col.heading}
              </h3>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 11,
                }}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink label={link.label} path={link.path} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{
          borderTop: `1px solid ${colors.surface[200]}`,
          backgroundColor: colors.surface[100],
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Left: copyright + author */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: colors.text.secondary,
              }}
            >
              © {currentYear} TypeTrace. All rights reserved.
            </p>
            <span
              style={{
                width: 1,
                height: 14,
                backgroundColor: colors.surface[200],
                flexShrink: 0,
              }}
            />
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: colors.text.secondary,
              }}
            >
              Built by{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: colors.text.primary,
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.brand;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.text.primary;
                }}
              >
                Simthass Mohammed
              </span>{" "}
              · BSc Computer Science · University of Bedfordshire
            </p>
          </div>

          {/* Right: trust badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {TRUST_BADGES.map(({ label, color, bg, border }) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color,
                  backgroundColor: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 6,
                  padding: "4px 9px",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.005em",
                }}
              >
                <ShieldCheck />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Responsive ── */}
      <style>{`
        @media (max-width: 900px) {
          .tt-footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 560px) {
          .tt-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
