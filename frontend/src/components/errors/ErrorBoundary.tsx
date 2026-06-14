// frontend/src/components/errors/ErrorBoundary.tsx

import { Component, type ErrorInfo, type ReactNode } from "react";

import { colors } from "../../styles/colors";
import { toast } from "../../lib/toast";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Unexpected application error.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TypeTrace UI error:", error, info);

    toast.error(
      "Application error",
      "A page failed to render. Refresh the page or return to the dashboard.",
    );
  }

  reset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="w-full max-w-xl rounded-md border p-6"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            boxShadow: `0 24px 70px ${colors.shadow}`,
          }}
        >
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-10 w-auto object-contain"
            draggable={false}
          />

          <h1
            className="mt-6 text-2xl font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            TypeTrace could not render this page.
          </h1>

          <p
            className="mt-3 text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            This is a frontend rendering error, not a certificate or evidence
            decision. Refresh the page or return to a safe workspace.
          </p>

          {this.state.errorMessage && (
            <pre
              className="mt-5 max-h-40 overflow-auto rounded-md border p-3 text-[12px]"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
                color: colors.text.secondary,
              }}
            >
              {this.state.errorMessage}
            </pre>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md px-4 py-2.5 text-[13px] font-bold"
              style={{
                background: colors.brand,
                color: colors.text.light,
              }}
            >
              Try again
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-md border px-4 py-2.5 text-[13px] font-bold"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
                color: colors.text.primary,
              }}
            >
              Go to home
            </button>
          </div>
        </div>
      </main>
    );
  }
}
