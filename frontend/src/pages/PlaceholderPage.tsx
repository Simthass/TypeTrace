import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({
  title,
  description = "This page is currently under development.",
}: PlaceholderPageProps) {
  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-brand-400/10 mb-5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="3"
            stroke="#2A7FE0"
            strokeWidth="1.5"
          />
          <path
            d="M8 12h8M8 8h5M8 16h3"
            stroke="#2A7FE0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-navy-800 mb-2">{title}</h1>
      <p className="text-sm text-navy-400 max-w-xs mb-6">{description}</p>
      <Link to={ROUTES.HOME} className="btn-primary">
        Back to home
      </Link>
    </section>
  );
}
