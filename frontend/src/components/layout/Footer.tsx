// frontend/src/components/layout/Footer.tsx

import React from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
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
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
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
      { label: "Academic Research", path: ROUTES.HELP_DOCS },
      { label: "Help Center", path: ROUTES.HELP_DOCS },
      { label: "Certificate Lookup", path: ROUTES.VERIFY_LOOKUP },
      { label: "Public Verification", path: ROUTES.VERIFY_LOOKUP },
    ],
  },
  {
    heading: "Trust",
    links: [
      { label: "Privacy Philosophy", path: ROUTES.SETTINGS },
      { label: "Data Portability", path: ROUTES.SETTINGS },
      { label: "Certificate Ledger", path: ROUTES.VERIFY_LOOKUP },
      { label: "Academic Integrity", path: ROUTES.ABOUT },
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

function FooterLink({ label, path }: { label: string; path: string }) {
  return (
    <Link
      to={path}
      className="rounded-md text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        color: colors.text.secondary,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = colors.text.primary;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = colors.text.secondary;
      }}
    >
      {label}
    </Link>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const dynamicStyles = {
    "--bg-footer": colors.text.light,
    "--border-light": colors.surface[200],
    "--border-soft": colors.surface[100],
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
      className="overflow-hidden border-t bg-[var(--bg-footer)] font-sans"
    >
      <div className="mx-auto max-w-[1440px] px-6 py-20 md:px-12">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-6">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Link
              to={ROUTES.HOME}
              className="w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-2"
              aria-label="TypeTrace Home"
            >
              <img
                src="/Logo.png"
                alt="TypeTrace"
                className="h-[35px] w-auto object-contain transition-opacity hover:opacity-80"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </Link>

            <p className="max-w-[340px] text-[14px] leading-[1.8] text-[var(--text-muted)]">
              Behavioral keystroke biometrics engineered to protect honest
              students and uphold institutional integrity in the generative AI
              era.
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-transparent bg-[var(--surface-50)] text-[var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-2"
                  onMouseEnter={(event) => {
                    event.currentTarget.style.color = "var(--action-primary)";
                    event.currentTarget.style.borderColor =
                      "var(--border-light)";
                    event.currentTarget.style.backgroundColor =
                      "var(--bg-footer)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.color = "var(--text-muted)";
                    event.currentTarget.style.borderColor = "transparent";
                    event.currentTarget.style.backgroundColor =
                      "var(--surface-50)";
                  }}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:col-span-4 lg:pl-12">
            {footerColumns.map((column) => (
              <div key={column.heading} className="flex flex-col gap-5">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                  {column.heading}
                </h3>

                <ul className="flex flex-col gap-3.5" role="list">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink label={link.label} path={link.path} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-light)] bg-[var(--surface-50)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-12">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <p className="text-[13px] font-medium text-[var(--text-muted)]">
              &copy; {currentYear} TypeTrace Systems.
            </p>

            <p className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
              Developed by{" "}
              <span className="font-semibold text-[var(--text-primary)] transition-colors hover:text-[var(--action-primary)]">
                Simthass Mohammed
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-[var(--border-light)] bg-[var(--bg-footer)] px-2.5 py-1.5">
              <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
                GDPR Ready
              </span>
            </div>

            <div className="rounded-md border border-[var(--border-light)] bg-[var(--bg-footer)] px-2.5 py-1.5">
              <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
                WCAG 2.1 AA
              </span>
            </div>

            <div
              className="rounded-md border px-2.5 py-1.5"
              style={{
                borderColor: brand.humanAccent,
                backgroundColor: brand.humanBg,
              }}
            >
              <span
                className="text-[11.5px] font-medium"
                style={{ color: brand.humanText }}
              >
                Verification Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
