import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES, PUBLIC_NAV } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const prevPathRef = useRef<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Pulling global state to check if user is logged in
  const { user, logout } = useAuthStore();

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
      setIsProfileMenuOpen(false);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    navigate(ROUTES.HOME);
  };

  // Get user initials for the avatar
  const getInitials = () => {
    if (!user || !user.first_name) return "U";
    return user.first_name.charAt(0).toUpperCase();
  };

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
                className="h-[35px] w-auto object-contain transition-opacity hover:opacity-80"
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
            {user ? (
              /* --- AUTHENTICATED STATE: Profile Dropdown --- */
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: isProfileMenuOpen
                      ? colors.surface[50]
                      : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    !isProfileMenuOpen &&
                    (e.currentTarget.style.backgroundColor = colors.surface[50])
                  }
                  onMouseLeave={(e) =>
                    !isProfileMenuOpen &&
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center font-bold text-[13px]"
                    style={{
                      backgroundColor: `${brand.action}15`,
                      color: brand.action,
                    }}
                  >
                    {getInitials()}
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.text.secondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isProfileMenuOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-xl border flex flex-col overflow-hidden"
                      style={{
                        backgroundColor: colors.text.light,
                        borderColor: colors.surface[200],
                      }}
                    >
                      <div
                        className="px-4 py-3 border-b"
                        style={{
                          borderColor: colors.surface[200],
                          backgroundColor: colors.surface[50],
                        }}
                      >
                        <p
                          className="text-[13px] font-semibold truncate"
                          style={{ color: colors.text.primary }}
                        >
                          {user.first_name}
                        </p>
                        <p
                          className="text-[12px] truncate mt-0.5"
                          style={{ color: colors.text.secondary }}
                        >
                          {user.email}
                        </p>
                      </div>
                      <div className="p-1.5 flex flex-col">
                        <Link
                          to={ROUTES.DASHBOARD}
                          className="px-3 py-2 text-[13px] font-medium rounded-md transition-colors"
                          style={{ color: colors.text.primary }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              colors.surface[50])
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          Dashboard
                        </Link>
                        <Link
                          to={ROUTES.EDITOR_NEW}
                          className="px-3 py-2 text-[13px] font-medium rounded-md transition-colors"
                          style={{ color: colors.text.primary }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              colors.surface[50])
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          New Verification Session
                        </Link>
                      </div>
                      <div
                        className="p-1.5 border-t"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-[13px] font-medium rounded-md transition-colors outline-none"
                          style={{ color: brand.aiAccent }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = `${brand.aiAccent}10`)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                        >
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* --- UNAUTHENTICATED STATE: Login/Register Buttons --- */
              <>
                <Link
                  to={ROUTES.LOGIN}
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
              </>
            )}
          </div>

          <button
            type="button"
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
