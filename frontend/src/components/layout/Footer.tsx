import { Link } from "react-router-dom";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ArrowRight() {
  return (
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
  );
}

function HashIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.1 1.3 3 9.7M8 1.3 6.9 9.7M1.3 3.9h8.4M0.8 7.1h8.4"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Keystroke rhythm — the footer's signature motif ─────────────────────────
// A static readout of an inter-key interval sequence: short bars are fast
// keystrokes, tall bars are pauses/hesitations, the occasional accent bar
// marks a corrected keystroke. It's the same signal TypeTrace analyzes,
// rendered as a quiet piece of typography rather than a decoration.

const RHYTHM_PATTERN = [
  3, 4, 3, 5, 8, 3, 4, 3, 3, 11, 4, 3, 5, 4, 3, 14, 3, 4, 3, 6, 4, 3, 9, 3, 4,
  5, 3, 4, 12, 3, 4, 3, 5, 4, 7, 3, 4, 3, 10, 4, 3, 5, 3, 4, 6, 3, 13, 4, 3, 5,
  4, 3, 8, 4, 3, 4,
];

function KeystrokeRhythm() {
  const barWidth = 3;
  const gap = 5;
  const height = 22;
  const width = RHYTHM_PATTERN.length * (barWidth + gap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {RHYTHM_PATTERN.map((h, i) => {
        const isAccent = h > 9;
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={1}
            fill={isAccent ? colors.brand : colors.surface[300]}
            opacity={isAccent ? 0.5 : 1}
          />
        );
      })}
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

// ─── Signature stats (rendered as a mono readout, not stat cards) ────────────

const STATS = [
  { value: "43", label: "timing features" },
  { value: "133", label: "validation sessions" },
  { value: "3", label: "evidence layers" },
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
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        backgroundColor: colors.surface[50],
        fontFamily: "inherit",
      }}
    >
      {/* ── Keystroke rhythm strip — the footer's one signature element ── */}
      <div
        style={{
          borderTop: `1px solid ${colors.surface[200]}`,
          borderBottom: `1px solid ${colors.surface[200]}`,
          backgroundColor: colors.surface[50],
          padding: "10px 32px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <KeystrokeRhythm />
        </div>
      </div>

      {/* ── Top CTA band ── */}
      <div
        style={{
          borderBottom: `1px solid ${colors.surface[200]}`,
          backgroundColor: colors.surface[100],
        }}
      >
        <div
          className="tt-footer-cta"
          style={{
            width: "100%",
            minWidth: 0,
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
          <div
            className="tt-footer-cta-copy"
            style={{ minWidth: 0, maxWidth: 520 }}
          >
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
            className="tt-footer-cta-actions"
            style={{
              display: "flex",
              minWidth: 0,
              maxWidth: "100%",
              alignItems: "center",
              gap: 10,
              flexShrink: 1,
              flexWrap: "wrap",
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
              <ArrowRight />
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
        className="tt-footer-body"
        style={{
          width: "100%",
          minWidth: 0,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "52px 32px 48px",
        }}
      >
        <div
          style={{
            display: "grid",
            minWidth: 0,
            gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(0, 1fr))",
            gap: "40px 48px",
          }}
          className="tt-footer-grid"
        >
          {/* ── Brand column ── */}
          <div
            style={{
              display: "flex",
              minWidth: 0,
              flexDirection: "column",
              gap: 20,
            }}
          >
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
                maxWidth: 280,
              }}
            >
              Writing-process evidence that supports fair academic review in the
              generative AI era.
            </p>

            {/* Signature stat readout — mono, not stat cards */}
            <dl
              className="tt-footer-stats"
              style={{
                display: "flex",
                margin: 0,
                gap: 18,
                flexWrap: "nowrap",
                whiteSpace: "nowrap",
              }}
            >
              {STATS.map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    paddingLeft: i === 0 ? 0 : 18,
                    borderLeft:
                      i === 0 ? "none" : `1px solid ${colors.surface[200]}`,
                  }}
                >
                  <dt
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: colors.text.primary,
                    }}
                  >
                    {stat.value}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      color: colors.text.muted,
                    }}
                  >
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ── Link columns ── */}
          {FOOTER_COLUMNS.map((col) => (
            <div
              key={col.heading}
              style={{
                display: "flex",
                minWidth: 0,
                flexDirection: "column",
                gap: 16,
              }}
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
          className="tt-footer-bottom"
          style={{
            width: "100%",
            minWidth: 0,
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
            className="tt-footer-meta"
            style={{
              display: "flex",
              minWidth: 0,
              maxWidth: "100%",
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
              className="tt-footer-meta-divider"
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
              <a
                href="https://simthass.dev/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontWeight: 600,
                  color: colors.text.primary,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.brand;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.text.primary;
                }}
              >
                Simthass Mohammed
              </a>{" "}
              · BSc Computer Science · University of Bedfordshire
            </p>
          </div>

          {/* Right: one concrete, verifiable technical fact — not a badge wall */}
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              margin: 0,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 11.5,
              color: colors.text.muted,
              letterSpacing: "-0.01em",
            }}
          >
            <HashIcon />
            SHA-256 evidence hashing
          </p>
        </div>
      </div>

      {/* ── Responsive ── */}
      <style>{`
        @media (max-width: 900px) {
          .tt-footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .tt-footer-bottom {
            align-items: flex-start !important;
          }
        }

        @media (max-width: 640px) {
          .tt-footer-cta {
            padding: 32px 16px !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 24px !important;
          }

          .tt-footer-cta-copy {
            max-width: none !important;
          }

          .tt-footer-cta-actions {
            width: 100%;
            flex-direction: column;
            align-items: stretch !important;
          }

          .tt-footer-cta-actions > a {
            width: 100%;
            justify-content: center;
            white-space: normal !important;
            text-align: center;
          }

          .tt-footer-body {
            padding: 40px 16px 36px !important;
          }

          .tt-footer-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 32px !important;
          }

          .tt-footer-stats {
            gap: 16px !important;
            flex-wrap: wrap !important;
            white-space: normal !important;
          }

          .tt-footer-bottom {
            padding: 16px !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 14px !important;
          }

          .tt-footer-meta {
            gap: 10px !important;
          }

          .tt-footer-meta-divider {
            display: none;
          }
        }
      `}</style>
    </footer>
  );
}
