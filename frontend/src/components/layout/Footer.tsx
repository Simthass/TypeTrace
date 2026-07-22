import { Link } from "react-router-dom";
import { brand, colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─── Icons ───────────────────────────────────────────────────────────────────

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

// ─── Trust badges ─────────────────────────────────────────────────────────────

const TRUST_BADGES = [
  {
    label: "Privacy-conscious design",
    color: colors.text.secondary,
    bg: colors.surface[100],
    border: colors.surface[200],
  },
  {
    label: "Keyboard-accessible interface",
    color: colors.text.secondary,
    bg: colors.surface[100],
    border: colors.surface[200],
  },
  {
    label: "SHA-256 evidence hashing",
    color: brand.humanText,
    bg: brand.humanBg,
    border: brand.humanAccent,
  },
] as const;

// ─── Stat items ───────────────────────────────────────────────────────────────

const STATS = [
  { value: "43", label: "Timing features" },
  { value: "133", label: "Controlled validation sessions" },
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
              Writing-process evidence
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
              Show how the work was written.
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13.5,
                color: colors.text.secondary,
                lineHeight: 1.6,
              }}
            >
              TypeTrace captures how a document develops and creates reviewable
              writing-process evidence for each completed session.
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
              Writing-process evidence that supports fair academic review in the
              generative AI era.
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
