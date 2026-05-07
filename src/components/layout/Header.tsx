import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ROUTES, PUBLIC_NAV } from "../../constants/routes";

/* ─── Hamburger ──────────────────────────────────────────────────────────── */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 flex-col justify-center gap-[5px]"
    >
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary origin-center transition-transform duration-200",
          open ? "translate-y-[6.5px] rotate-45" : "",
        )}
      />
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100",
        )}
      />
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary origin-center transition-transform duration-200",
          open ? "-translate-y-[6.5px] -rotate-45" : "",
        )}
      />
    </span>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  const location = useLocation();

  // Close mobile menu on route change — using ref to avoid setState-in-effect cascade
  useEffect(() => {
    if (
      prevPathRef.current !== null &&
      prevPathRef.current !== location.pathname
    ) {
      setMobileOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // Detect scroll for border shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes mobile menu
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        role="banner"
        className={clsx(
          "fixed inset-x-0 top-0 z-50 h-[68px] bg-surface-50",
          "transition-all duration-200",
          scrolled
            ? "shadow-[0_1px_0_#D1D9E0,0_2px_12px_rgba(26,35,50,0.06)]"
            : "border-b border-surface-200",
        )}
      >
        <div
          className="h-full flex items-center justify-between"
          style={{ paddingLeft: "75px", paddingRight: "75px" }}
        >
          {/* Logo — image only, no wordmark (text already in logo) */}
          <Link
            to={ROUTES.HOME}
            className="flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            aria-label="TypeTrace — home"
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              height={38}
              className="h-[38px] w-auto object-contain"
              onError={(e) => {
                // show nothing if logo missing — avoids broken image
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </Link>

          {/* Desktop nav — centered */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-0.5"
          >
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === ROUTES.HOME}
                className={({ isActive }) =>
                  clsx(
                    "relative px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
                    isActive
                      ? "text-brand bg-brand/5"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              to={ROUTES.LOGIN}
              className="px-4 py-2 text-[14px] font-medium text-text-secondary rounded-lg border border-surface-200 transition-all duration-150 hover:border-brand/40 hover:text-brand hover:bg-brand/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
            >
              Log in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-4 py-2 text-[14px] font-medium text-white bg-brand rounded-lg transition-all duration-150 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Get started
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </header>

      {/* Mobile backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={clsx(
          "fixed inset-0 z-40 bg-black/30 lg:hidden transition-opacity duration-200",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      {/* Mobile drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={clsx(
          "fixed inset-x-0 top-[68px] z-40 lg:hidden",
          "bg-surface-50 border-b border-surface-200",
          "transition-all duration-200",
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none",
        )}
      >
        <div className="px-5 py-4">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === ROUTES.HOME}
                className={({ isActive }) =>
                  clsx(
                    "px-3 py-2.5 text-[14px] font-medium rounded-lg transition-colors duration-150",
                    isActive
                      ? "bg-brand/8 text-brand"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-surface-200 flex flex-col gap-2.5">
            <Link
              to={ROUTES.LOGIN}
              className="flex justify-center px-4 py-2.5 text-[14px] font-medium text-brand border border-brand/30 rounded-lg transition-colors duration-150 hover:bg-brand/5"
            >
              Log in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="flex justify-center px-4 py-2.5 text-[14px] font-medium text-white bg-brand rounded-lg transition-colors duration-150 hover:bg-brand-hover"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
