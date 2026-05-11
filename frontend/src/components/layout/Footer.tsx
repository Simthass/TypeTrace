import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

// Crisp, perfectly curved SVG icons
function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      width="20"
      height="20"
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
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const footerColumns = [
  {
    heading: "Platform",
    links: [
      { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
      { label: "Features Stack", path: ROUTES.FEATURES },
      { label: "Dashboard", path: ROUTES.DASHBOARD },
      { label: "Enterprise Pricing", path: ROUTES.PRICING },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Academic Research", path: "/#docs" },
      { label: "University Partners", path: "/#partners" },
      { label: "Help Center", path: "/#faq" },
      { label: "System Status", path: "/#status" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { label: "Privacy Philosophy", path: "/#privacy" },
      { label: "Terms of Service", path: "/#terms" },
      { label: "Data Portability", path: "/#gdpr" },
    ],
  },
] as const;

const socialLinks = [
  { label: "GitHub Repository", href: "https://github.com", Icon: GitHubIcon },
  { label: "Follow on X", href: "https://twitter.com", Icon: TwitterIcon },
  {
    label: "LinkedIn Network",
    href: "https://linkedin.com",
    Icon: LinkedInIcon,
  },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();

  // Strict mapping to your colors.ts source of truth
  const dynamicStyles = {
    "--bg-footer": colors.text.light,
    "--border-light": colors.surface[200],
    "--text-primary": colors.text.primary,
    "--text-muted": colors.text.secondary,
    "--action-primary": brand.action,
    "--action-hover": brand.actionHover,
    "--verify-green": brand.humanText,
    "--verify-bg": brand.humanBg,
    "--verify-border": brand.humanAccent,
    "--surface-50": colors.surface[50],
  } as React.CSSProperties;

  return (
    <footer
      role="contentinfo"
      style={dynamicStyles}
      className="bg-[var(--bg-footer)] border-t border-[var(--border-light)] overflow-hidden font-sans"
    >
      {/* ─── Main Grid Area ─── */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-6">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Link
              to={ROUTES.HOME}
              className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-2"
              aria-label="TypeTrace Home"
            >
              <img
                src="/Logo.png"
                alt="TypeTrace"
                className="h-[35px] w-auto object-contain transition-opacity hover:opacity-80"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </Link>

            <p className="text-[14px] leading-[1.8] text-[var(--text-muted)] max-w-[320px]">
              Behavioral keystroke biometrics engineered to protect honest
              students and uphold institutional integrity in the generative AI
              era.
            </p>

            {/* Strict Social Links - No round pills, no shadows */}
            <div className="flex items-center gap-2 mt-2">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  // STRICT TOKEN: rounded-lg
                  className="flex items-center justify-center h-10 w-10 rounded-lg border border-transparent bg-[var(--surface-50)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)]"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--action-primary)";
                    e.currentTarget.style.borderColor = "var(--border-light)";
                    e.currentTarget.style.backgroundColor = "var(--bg-footer)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.backgroundColor = "var(--surface-50)";
                  }}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Dynamic Link Columns */}
          <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-10 lg:pl-12">
            {footerColumns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-5">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                  {col.heading}
                </h3>
                <ul className="flex flex-col gap-3.5" role="list">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.path}
                        // Minimalist text color transition. Removed the 2021 animated underline.
                        className="text-[14px] font-medium text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--action-primary)] rounded-md"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Legal & Status Bar ─── */}
      <div className="border-t border-[var(--border-light)] bg-[var(--surface-50)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
            <p className="text-[13px] font-medium text-[var(--text-muted)]">
              &copy; {currentYear} TypeTrace Systems.
            </p>
            <p className="text-[13px] text-[var(--text-muted)] flex items-center gap-1.5">
              Developed by{" "}
              <span className="font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--action-primary)] cursor-pointer">
                Simthass Mohammed
              </span>
            </p>
          </div>

          {/* System Status Indicators */}
          <div className="flex flex-wrap items-center gap-3">
            {/* STRICT TOKEN: rounded-md */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-footer)] border border-[var(--border-light)]">
              <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
                GDPR Compliant
              </span>
            </div>

            {/* STRICT TOKEN: rounded-md */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-footer)] border border-[var(--border-light)]">
              <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
                WCAG 2.1 AA
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
