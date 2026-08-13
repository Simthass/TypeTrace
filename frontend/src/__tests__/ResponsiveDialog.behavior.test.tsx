import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResponsiveDialog } from "../components/ui/ResponsiveDialog";

let originalOffsetParent: PropertyDescriptor | undefined;

beforeEach(() => {
  originalOffsetParent = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetParent",
  );
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
});

afterEach(() => {
  if (originalOffsetParent) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetParent",
      originalOffsetParent,
    );
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)
      .offsetParent;
  }
});

describe("ResponsiveDialog keyboard and focus behavior", () => {
  it("focuses the first control and restores focus to the explicit opener", async () => {
    const onClose = vi.fn();
    const openerRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <>
        <button ref={openerRef}>Open dialog</button>
        <ResponsiveDialog
          open={false}
          onClose={onClose}
          title="Coverage dialog"
          returnFocusRef={openerRef}
        >
          <button>First action</button>
        </ResponsiveDialog>
      </>,
    );

    openerRef.current?.focus();
    rerender(
      <>
        <button ref={openerRef}>Open dialog</button>
        <ResponsiveDialog
          open
          onClose={onClose}
          title="Coverage dialog"
          returnFocusRef={openerRef}
        >
          <button>First action</button>
        </ResponsiveDialog>
      </>,
    );

    expect(await screen.findByRole("dialog", { name: "Coverage dialog" })).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "First action" })).toHaveFocus(),
    );

    rerender(
      <>
        <button ref={openerRef}>Open dialog</button>
        <ResponsiveDialog
          open={false}
          onClose={onClose}
          title="Coverage dialog"
          returnFocusRef={openerRef}
        >
          <button>First action</button>
        </ResponsiveDialog>
      </>,
    );

    await waitFor(() => expect(openerRef.current).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and traps forward/backward Tab at dialog boundaries", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveDialog open onClose={onClose} ariaLabel="Actions">
        <button>First</button>
        <button>Last</button>
      </ResponsiveDialog>,
    );

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("honors the backdrop close policy", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <ResponsiveDialog open onClose={onClose} ariaLabel="Backdrop test">
        <span>Body</span>
      </ResponsiveDialog>,
    );

    fireEvent.mouseDown(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <ResponsiveDialog
        open
        onClose={onClose}
        ariaLabel="Backdrop test"
        closeOnBackdrop={false}
      >
        <span>Body</span>
      </ResponsiveDialog>,
    );
    fireEvent.mouseDown(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps focus on the panel when no tabbable controls exist", () => {
    render(
      <ResponsiveDialog open onClose={vi.fn()} ariaLabel="Empty dialog">
        <span>No controls</span>
      </ResponsiveDialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Empty dialog" });
    dialog.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog).toHaveFocus();
  });
});
