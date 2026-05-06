import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";

// github icon as svg - keeping it inline so no extra http requests
// this is how most students would do it to avoid dependency issues
function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

// x/twitter icon - using the newer X style
function TwitterIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// linkedin icon
function LinkedInIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// footer column data - all the links organized by category
// using ROUTES constants so if routes change, these update automatically
const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
      { label: "Features", path: ROUTES.FEATURES },
      { label: "Dashboard", path: ROUTES.DASHBOARD },
      { label: "Pricing", path: ROUTES.PRICING },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Documentation", path: "/#docs" },
      { label: "Contact", path: "/#contact" },
      { label: "FAQ", path: "/#faq" },
      { label: "Status", path: "/#status" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", path: "/#privacy" },
      { label: "Terms of Service", path: "/#terms" },
      { label: "Cookie Policy", path: "/#cookies" },
    ],
  },
] as const;

// social media links with their icons
const socialLinks = [
  { label: "GitHub", href: "https://github.com", Icon: GitHubIcon },
  { label: "Twitter", href: "https://twitter.com", Icon: TwitterIcon },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedInIcon },
] as const;

// main footer component - used across all public pages
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="bg-white border-t border-surface-200">
      {/* thin brand colored accent line at the very top */}
      <div className="h-[2px] bg-brand/70" aria-hidden="true" />

      {/* main footer content area with 75px horizontal padding */}
      <div
        className="py-14 lg:py-16"
        style={{ paddingLeft: "75px", paddingRight: "75px" }}
      >
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* brand column - takes 2 columns on large screens, has logo and description */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* larger logo with hover effect */}
            <Link
              to={ROUTES.HOME}
              className="w-fit rounded-md transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="TypeTrace — back to home"
            >
              <img
                src="/Logo.png"
                alt="TypeTrace"
                width={150}
                height={42}
                className="h-[42px] w-auto object-contain shrink-0"
                onError={(e) => {
                  // if logo fails to load, hide the broken image
                  // and show nothing instead of ugly broken image icon
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = "none";
                }}
              />
            </Link>

            {/* short description about what typetrace does */}
            <p className="text-[14px] leading-relaxed text-text-secondary max-w-xs">
              Keystroke biometric analysis for verifying academic authorship.
              Built for universities, educators, and students who care about
              integrity.
            </p>

            {/* social media icons row */}
            <div
              className="flex items-center gap-1.5"
              aria-label="Social media links"
            >
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center justify-center h-9 w-9 rounded-lg text-text-secondary
                             transition-colors duration-150 hover:text-brand hover:bg-brand/5
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand
                             focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* link columns - each one is product, support, or legal */}
          {footerColumns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3.5">
              {/* column heading in uppercase with tracking */}
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary/70">
                {col.heading}
              </h3>
              {/* list of links under the heading */}
              <ul className="flex flex-col gap-2.5" role="list">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-[14px] text-text-secondary transition-colors duration-150
                                 hover:text-text-primary focus-visible:outline-none
                                 focus-visible:ring-1 focus-visible:ring-brand rounded-sm"
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

      {/* bottom bar with copyright and tech stack info */}
      <div className="border-t border-surface-200">
        <div
          className="py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingLeft: "75px", paddingRight: "75px" }}
        >
          {/* copyright text */}
          <p className="text-[12px] text-text-secondary/70">
            &copy; TypeTrace All Rights Reserved {currentYear}. Developed By{" "}
            <span className="font-bold">Simthass Mohammed</span>
          </p>

          {/* right side with wcag badge and tech stack */}
          <div className="flex items-center gap-5">
            {/* accessibility compliance badge */}
            <span
              className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary/70 border
                         border-surface-200 rounded-full px-3 py-1 select-none"
              title="WCAG 2.1 Level AA Compliant"
            >
              {/* small green checkmark circle */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="5"
                  cy="5"
                  r="4"
                  stroke="#10B67E"
                  strokeWidth="1.2"
                />
                <path
                  d="M3 5l1.5 1.5L7 3.5"
                  stroke="#10B67E"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              WCAG 2.1 AA
            </span>

            {/* tech stack display - showing what we built with */}
            <span className="text-[12px] text-text-secondary/70">
              <span className="font-medium text-text-secondary">
                TypeScript
              </span>{" "}
              · <span className="font-medium text-text-secondary">React</span> ·{" "}
              <span className="font-medium text-text-secondary">FastAPI</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
