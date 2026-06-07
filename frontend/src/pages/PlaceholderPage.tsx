// frontend/src/pages/PlaceholderPage.tsx

import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({
  title,
  description = "This page is currently being prepared for the final TypeTrace release.",
}: PlaceholderPageProps) {
  return (
    <section
      className="flex min-h-[70vh] items-center justify-center px-6 py-16"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="w-full max-w-md rounded-md border bg-white p-8 text-center shadow-saas"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-md"
          style={{ background: brand.bgNavActive, color: colors.brand }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
            <path d="M8 17h3" />
          </svg>
        </div>

        <h1
          className="mt-5 text-2xl font-semibold tracking-[-0.03em]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>

        <p
          className="mx-auto mt-2 max-w-xs text-[14px] leading-6"
          style={{ color: colors.text.secondary }}
        >
          {description}
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Link
            to={ROUTES.HOME}
            className="rounded-md border px-4 py-2 text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Home
          </Link>

          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Verify Certificate
          </Link>
        </div>
      </div>
    </section>
  );
}
