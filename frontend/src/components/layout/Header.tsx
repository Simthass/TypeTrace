import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES, PUBLIC_NAV } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

function MenuToggleIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      className="relative w-[18px] h-[14px] flex flex-col justify-between items-center"
      aria-hidden="true"
    >
      <motion.span
        className="w-full h-[1.5px] rounded-full origin-left"
        style={{ backgroundColor: colors.text.primary }}
        animate={{ rotate: isOpen ? 45 : 0, y: isOpen ? -1.5 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="w-full h-[1.5px] rounded-full"
        style={{ backgroundColor: colors.text.primary }}
        animate={{ opacity: isOpen ? 0 : 1, x: isOpen ? 8 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
      <motion.span
        className="w-full h-[1.5px] rounded-full origin-left"
        style={{ backgroundColor: colors.text.primary }}
        animate={{ rotate: isOpen ? -45 : 0, y: isOpen ? 1.5 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (
      prevPathRef.current !== null &&
      prevPathRef.current !== location.pathname
    ) {
      setIsMobileMenuOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header
        role="banner"
        className="fixed top-0 inset-x-0 z-50 transition-colors duration-300"
        style={{
          backgroundColor: colors.text.light,
          borderBottom: isScrolled
            ? `1px solid ${colors.surface[200]}`
            : "1px solid transparent",
          height: "64px",
        }}
      >
        <div className="h-full w-full max-w-[1440px] mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex-shrink-0 flex items-center">
            <Link
              to={ROUTES.HOME}
              className="flex items-center outline-none focus-visible:ring-2 rounded-lg"
            >
              <img
                src="/Logo.png"
                alt="TypeTrace"
                className="h-[37px] w-auto object-contain transition-opacity hover:opacity-80"
              />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {PUBLIC_NAV.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  // STRICT TOKEN: rounded-lg (8px)
                  className="relative px-4 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-200 outline-none"
                  style={{
                    color: isActive
                      ? colors.text.primary
                      : colors.text.secondary,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.color = colors.text.primary;
                    e.currentTarget.style.backgroundColor = colors.surface[50];
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.color = colors.text.secondary;
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span className="relative z-10">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-1 left-4 right-4 h-[2px] rounded-full"
                      style={{ backgroundColor: colors.text.primary }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link
              to={ROUTES.LOGIN}
              // STRICT TOKEN: rounded-lg (8px)
              className="px-4 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-200 outline-none"
              style={{ color: colors.text.secondary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.text.primary;
                e.currentTarget.style.backgroundColor = colors.surface[50];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.text.secondary;
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Sign In
            </Link>

            <Link
              to={ROUTES.REGISTER}
              // STRICT TOKEN: rounded-lg (8px)
              className="px-5 py-2 rounded-lg text-[13.5px] font-medium text-white transition-all duration-200 outline-none"
              style={{ backgroundColor: brand.action }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = brand.actionHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = brand.action)
              }
            >
              Start Free Session
            </Link>
          </div>

          <button
            type="button"
            // STRICT TOKEN: rounded-lg (8px)
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colors.surface[50])
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <MenuToggleIcon isOpen={isMobileMenuOpen} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-40 pt-[64px] flex flex-col md:hidden"
            style={{ backgroundColor: colors.text.light }}
          >
            <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col">
              <nav className="flex flex-col gap-2 mb-auto">
                {PUBLIC_NAV.map((item, index) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== "/" &&
                      location.pathname.startsWith(item.path));
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={item.path}
                        // STRICT TOKEN: rounded-lg (8px)
                        className="block px-4 py-3 rounded-lg text-xl font-semibold tracking-tight transition-colors"
                        style={{
                          color: isActive ? brand.action : colors.text.primary,
                          backgroundColor: isActive
                            ? `${brand.action}10`
                            : "transparent",
                        }}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col gap-3 pt-8 border-t"
                style={{ borderColor: colors.surface[200] }}
              >
                <Link
                  to={ROUTES.LOGIN}
                  // STRICT TOKEN: rounded-lg (8px)
                  className="w-full py-3.5 rounded-lg text-[15px] font-medium text-center border transition-colors"
                  style={{
                    color: colors.text.primary,
                    borderColor: colors.surface[200],
                  }}
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.REGISTER}
                  // STRICT TOKEN: rounded-lg (8px)
                  className="w-full py-3.5 rounded-lg text-[15px] font-medium text-center text-white transition-colors"
                  style={{ backgroundColor: brand.action }}
                >
                  Start Free Session
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
