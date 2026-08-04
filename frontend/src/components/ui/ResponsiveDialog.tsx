import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogPosition = "center" | "right";

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
  position?: DialogPosition;
  className?: string;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Accessible responsive overlay used by mobile sheets and desktop dialogs.
 * It locks background scrolling, restores focus, handles Escape, and traps Tab
 * navigation inside the open panel.
 */
export function ResponsiveDialog({
  open,
  onClose,
  children,
  title,
  ariaLabel,
  position = "center",
  className = "",
  panelClassName = "",
  closeOnBackdrop = true,
  returnFocusRef,
}: ResponsiveDialogProps) {
  const generatedTitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const returnFocusTarget =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    return () => {
      if (returnFocusTarget?.isConnected) {
        try {
          returnFocusTarget.focus({ preventScroll: true });
        } catch {
          returnFocusTarget.focus();
        }
      }
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const isRightSheet = position === "right";
  const placement = isRightSheet
    ? "items-end justify-center sm:items-stretch sm:justify-end"
    : "items-end justify-center sm:items-center";
  const panelPlacement = isRightSheet
    ? "max-h-[92dvh] w-full rounded-t-2xl sm:h-full sm:max-h-none sm:max-w-[440px] sm:rounded-none"
    : "max-h-[92dvh] w-full rounded-t-2xl sm:max-w-3xl sm:rounded-xl";

  return (
    <div className={`fixed inset-0 z-50 flex ${placement} ${className}`}>
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-hidden="true"
        onMouseDown={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? generatedTitleId : undefined}
        tabIndex={-1}
        className={`relative z-10 flex min-w-0 flex-col overflow-hidden bg-white shadow-2xl outline-none ${panelPlacement} ${panelClassName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {title && (
          <span id={generatedTitleId} className="sr-only">
            {title}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
