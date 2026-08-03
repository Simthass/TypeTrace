import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ResponsiveDataView } from "../components/ui/ResponsiveDataView";
import { ResponsiveDialog } from "../components/ui/ResponsiveDialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open details
      </button>
      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Responsive details"
        position="right"
      >
        <button type="button" onClick={() => setOpen(false)}>
          Close details
        </button>
      </ResponsiveDialog>
    </>
  );
}

describe("responsive foundation", () => {
  it("renders mobile and desktop representations with complementary breakpoints", () => {
    const { container } = render(
      <ResponsiveDataView
        mobile={<div>Mobile records</div>}
        desktop={<table aria-label="Desktop records" />}
      />,
    );

    expect(screen.getByText("Mobile records")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Desktop records" })).toBeInTheDocument();
    expect(container.querySelector(".xl\\:hidden")).toBeInTheDocument();
    expect(container.querySelector(".hidden.xl\\:block")).toBeInTheDocument();
  });

  it("locks background scrolling, closes on Escape, and restores focus", () => {
    render(<DialogHarness />);

    const opener = screen.getByRole("button", { name: "Open details" });
    opener.focus();
    fireEvent.click(opener);

    expect(
      screen.getByRole("dialog", { name: "Responsive details" }),
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Close details" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Responsive details" }),
    ).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(opener).toHaveFocus();
  });
});


