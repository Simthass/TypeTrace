import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyLookupPage from "../pages/VerifyLookupPage";
import { ROUTES } from "../constants/routes";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

function renderLookup() {
  return render(
    <MemoryRouter>
      <VerifyLookupPage />
    </MemoryRouter>,
  );
}

describe("VerifyLookupPage", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
  });

  it("requires a certificate identifier before opening a public record", () => {
    renderLookup();

    fireEvent.click(screen.getByRole("button", { name: "Verify certificate" }));

    expect(navigate).not.toHaveBeenCalled();
    expect(document.getElementById("certificate-id-error")).toHaveTextContent(
      "Enter the certificate ID printed on the certificate or supplied in its verification link.",
    );
    expect(screen.getByText("Certificate ID not accepted")).toBeVisible();
  });

  it("rejects an incomplete certificate identifier without navigating", () => {
    renderLookup();

    fireEvent.change(screen.getByRole("textbox", { name: "Certificate ID" }), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify certificate" }));

    expect(navigate).not.toHaveBeenCalled();
    expect(document.getElementById("certificate-id-error")).toHaveTextContent(
      "The certificate ID is incomplete. Check the full ID and try again.",
    );
  });

  it("rejects unsupported characters in an otherwise long certificate identifier", () => {
    renderLookup();

    fireEvent.change(screen.getByRole("textbox", { name: "Certificate ID" }), {
      target: { value: "TT26 BAD!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify certificate" }));

    expect(navigate).not.toHaveBeenCalled();
    expect(document.getElementById("certificate-id-error")).toHaveTextContent(
      "Use only letters, numbers, dashes, and underscores in the certificate ID.",
    );
  });

  it("uppercases and trims a valid certificate identifier before routing to the public result", () => {
    renderLookup();

    const input = screen.getByRole("textbox", { name: "Certificate ID" });
    fireEvent.change(input, { target: { value: "  tt26-a1b2c3d4  " } });
    fireEvent.click(screen.getByRole("button", { name: "Verify certificate" }));

    expect(input).toHaveValue("TT26-A1B2C3D4");
    expect(navigate).toHaveBeenCalledWith(
      ROUTES.VERIFY.replace(":certId", "TT26-A1B2C3D4"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
