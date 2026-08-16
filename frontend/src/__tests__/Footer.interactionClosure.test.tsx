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

describe("Footer final interaction closure", () => {
  it("executes hover state contracts for CTA links, directory links, and author metadata", () => {
    renderFooter();

    const start = screen.getByRole("link", { name: /Start free session/ });
    const startBackground = start.style.backgroundColor;
    fireEvent.mouseEnter(start);
    expect(start.style.backgroundColor).not.toBe(startBackground);
    fireEvent.mouseLeave(start);
    expect(start.style.backgroundColor).toBe(startBackground);

    const verify = screen.getByRole("link", { name: "Verify a certificate" });
    const verifyColor = verify.style.color;
    const verifyBorder = verify.style.borderColor;
    fireEvent.mouseEnter(verify);
    expect(verify.style.color).not.toBe(verifyColor);
    expect(verify.style.borderColor).not.toBe(verifyBorder);
    fireEvent.mouseLeave(verify);
    expect(verify.style.color).toBe(verifyColor);
    expect(verify.style.borderColor).toBe(verifyBorder);

    const directory = screen.getByRole("link", { name: "How It Works" });
    const directoryColor = directory.style.color;
    fireEvent.mouseEnter(directory);
    expect(directory.style.color).not.toBe(directoryColor);
    fireEvent.mouseLeave(directory);
    expect(directory.style.color).toBe(directoryColor);

    const author = screen.getByText("Simthass Mohammed");
    const authorColor = author.style.color;
    fireEvent.mouseEnter(author);
    expect(author.style.color).not.toBe(authorColor);
    fireEvent.mouseLeave(author);
    expect(author.style.color).toBe(authorColor);
  });
});
