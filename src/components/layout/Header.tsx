import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ROUTES, PUBLIC_NAV } from "../../constants/routes";

// simple hamburger menu icon - 3 lines to X animation
// used for mobile menu toggle button
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 flex-col justify-center gap-[5px]"
    >
      {/* first line - rotates down to form X */}
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary origin-center transition-all duration-200 ease-out",
          open && "translate-y-[6.5px] rotate-45",
        )}
      />
      {/* middle line - fades away when menu opens */}
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary transition-all duration-150 ease-out",
          open && "opacity-0 scale-x-0",
        )}
      />
      {/* last line - rotates up to complete the X */}
      <span
        className={clsx(
          "block h-[1.5px] w-full bg-text-primary origin-center transition-all duration-200 ease-out",
          open && "-translate-y-[6.5px] -rotate-45",
        )}
      />
    </span>
  );
}

// logo component - just the image, text is inside the logo image already
// has fallback icon incase image fails to load for whatever reason
function Logo() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      to={ROUTES.HOME}
      className="flex items-center rounded-md transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50"
      aria-label="TypeTrace — go to homepage"
    >
      {!imgFailed ? (
        <img
          src="/Logo.png"
          alt="TypeTrace"
          width={148}
          height={40}
          className="h-10 w-auto object-contain shrink-0"
          onError={() => setImgFailed(true)}
        />
      ) : (
        // geometric fallback mark if logo image dont load
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand shrink-0"
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 3.5h12M7 3.5v11M11 3.5v11"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M7 9.5c0-1.1.9-2 2-2s2 .9 2 2"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
    </Link>
  );
}

// main header component with fixed positioning and responsive behavior
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  const location = useLocation();

  // when user navigates to different page, close the mobile menu
  // using ref comparison to avoid extra re-renders
  useEffect(() => {
    if (
      prevPathRef.current !== null &&
      prevPathRef.current !== location.pathname
    ) {
      setMobileOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // track scroll position to add subtle shadow after scrolling
  // only fires when scroll crosses the 4px threshold
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 8);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // accessibility - close mobile menu when user presses escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // prevent background page scrolling when mobile menu is visible
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : originalOverflow;
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* header bar - fixed at top with backdrop blur for modern glass effect */}
      <header
        role="banner"
        className={clsx(
          "fixed inset-x-0 top-0 z-50 h-[68px]",
          "bg-surface-50/95 backdrop-blur-md",
          "transition-shadow duration-300 ease-out",
          scrolled
            ? "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_12px_rgba(0,0,0,0.03)]"
            : "shadow-none",
        )}
      >
        {/* subtle bottom border line */}
        <div
          className="absolute inset-x-0 bottom-0 h-[0.5px] bg-surface-200/80"
          aria-hidden="true"
        />

        {/* main header content with 75px left and right padding */}
        <div
          className="flex h-full items-center justify-between"
          style={{ paddingLeft: "75px", paddingRight: "75px" }}
        >
          {/* logo on the left */}
          <Logo />

          {/* center navigation - only visible on desktop */}
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
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-surface-50",
                    isActive
                      ? "text-brand bg-brand/5"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-100/70",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {/* subtle active indicator dot instead of underline */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[2.5px] w-4 bg-brand rounded-full"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* right side auth buttons - desktop only */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to={ROUTES.LOGIN}
              className="px-4 py-2 text-[14px] font-medium text-text-secondary rounded-lg transition-all duration-150 hover:text-text-primary hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-surface-50"
            >
              Login
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-5 py-2 text-[14px] font-medium text-white bg-brand rounded-lg transition-all duration-150 hover:bg-brand-hover hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50 active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>

          {/* hamburger button for mobile screens */}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-text-primary transition-colors duration-150 hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-surface-50"
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </header>

      {/* semi-transparent overlay behind mobile menu */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={clsx(
          "fixed inset-0 z-40 bg-black/30 lg:hidden",
          "transition-opacity duration-250 ease-out",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      {/* slide-down mobile menu drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={clsx(
          "fixed inset-x-0 top-[68px] z-40 lg:hidden",
          "bg-white border-t border-surface-200 rounded-b-2xl shadow-lg",
          "transition-all duration-250 ease-out",
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-3 pointer-events-none",
        )}
      >
        <div
          className="py-5"
          style={{ paddingLeft: "75px", paddingRight: "75px" }}
        >
          {/* mobile nav links */}
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === ROUTES.HOME}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center px-4 py-3 text-[14px] font-medium rounded-lg transition-colors duration-150",
                    isActive
                      ? "bg-brand/8 text-brand"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-50",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* mobile auth buttons with some spacing from nav links */}
          <div className="mt-5 pt-5 border-t border-surface-200 flex flex-col gap-3">
            <Link
              to={ROUTES.LOGIN}
              className="flex items-center justify-center px-4 py-3 text-[14px] font-medium text-text-secondary border border-surface-200 rounded-lg transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.99]"
            >
              Login
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center justify-center px-4 py-3 text-[14px] font-medium text-white bg-brand rounded-lg transition-all duration-150 hover:bg-brand-hover active:scale-[0.99]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
