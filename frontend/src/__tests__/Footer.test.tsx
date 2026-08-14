import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Footer from "../components/layout/Footer";

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

describe("Footer", () => {
  it("renders the conversion band, product statistics, and complete navigation directory", () => {
    renderFooter();

    expect(
      screen.getByRole("heading", { name: "Show how the work was written." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Start free session" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(
      screen.getByRole("link", { name: "Verify a certificate" }),
    ).toHaveAttribute("href", "/verify");

    expect(screen.getByText("43")).toBeVisible();
    expect(screen.getByText("Timing features")).toBeVisible();
    expect(screen.getByText("133")).toBeVisible();
    expect(screen.getByText("Controlled validation sessions")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("Evidence layers")).toBeVisible();

    expect(screen.getByRole("link", { name: "Student Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Teacher Console" })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
    expect(screen.getByRole("link", { name: "Certificate Lookup" })).toHaveAttribute(
      "href",
      "/verify",
    );
    expect(screen.getByRole("link", { name: "Privacy & GDPR" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("renders thesis-relevant trust claims, ownership metadata, and interactive link states", () => {
    renderFooter();

    expect(screen.getByText("Privacy-conscious design")).toBeVisible();
    expect(screen.getByText("Keyboard-accessible interface")).toBeVisible();
    expect(screen.getByText("SHA-256 evidence hashing")).toBeVisible();
    expect(screen.getByText("Simthass Mohammed")).toBeVisible();
    expect(screen.getByText(/University of Bedfordshire/)).toBeVisible();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} TypeTrace`))).toBeVisible();

    const howItWorks = screen.getByRole("link", { name: "How It Works" });
    fireEvent.mouseEnter(howItWorks);
    fireEvent.mouseLeave(howItWorks);
    expect(howItWorks).toHaveAttribute("href", "/how-it-works");
  });
});
