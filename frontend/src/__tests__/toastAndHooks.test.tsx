import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ui/ToastProvider";
import { useToast } from "../components/ui/ToastContext";
import { useCertificateDownload } from "../hooks/useCertificateDownload";
import { useSafeRequest } from "../hooks/useSafeRequest";
import { api } from "../lib/api";
import { notify, toast } from "../lib/toast";

function ToastHarness() {
  const { success } = useToast();
  return (
    <button type="button" onClick={() => success("Saved", "Stored safely") }>
      Show toast
    </button>
  );
}

function SafeRequestHarness() {
  const { run, isLoading } = useSafeRequest();
  const [value, setValue] = useState("idle");
  return (
    <>
      <span>{isLoading ? "loading" : value}</span>
      <button
        type="button"
        onClick={() =>
          void run(async () => "done", {
            showSuccessToast: true,
            successTitle: "Request complete",
          }).then((result) => setValue(result ?? "null"))
        }
      >
        Succeed
      </button>
      <button
        type="button"
        onClick={() =>
          void run(async () => {
            throw new Error("boom");
          }).then((result) => setValue(result ?? "null"))
        }
      >
        Fail
      </button>
    </>
  );
}

function DownloadHarness() {
  const { downloadingId, downloadCertificate } = useCertificateDownload();
  return (
    <>
      <span>{downloadingId || "idle"}</span>
      <button type="button" onClick={() => void downloadCertificate("") }>
        Missing
      </button>
      <button
        type="button"
        onClick={() => void downloadCertificate("TT/COVERAGE-1")}
      >
        Download
      </button>
    </>
  );
}

describe("toast provider and reusable request/download hooks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders global and context toasts, deduplicates, and permits manual dismissal", () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show toast" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      notify({ type: "info", title: "Global update", duration: 0 });
      notify({ type: "info", title: "Global update", duration: 0 });
    });
    expect(screen.getAllByText("Global update")).toHaveLength(1);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Dismiss notification" })[0],
    );
    expect(screen.queryByText("Global update")).not.toBeInTheDocument();
  });

  it("auto-dismisses a toast after its configured duration", async () => {
    vi.useFakeTimers();
    render(<ToastProvider><div>child</div></ToastProvider>);
    act(() => {
      toast.info("Temporary", "Short lived", 25);
    });
    expect(screen.getByText("Temporary")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
  });

  it("serializes a reusable safe request and produces success/error feedback", async () => {
    render(
      <ToastProvider>
        <SafeRequestHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Succeed" }));
    expect(await screen.findByText("done")).toBeInTheDocument();
    expect(screen.getByText("Request complete")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(await screen.findByText("null")).toBeInTheDocument();
    expect(screen.getByText("Request failed")).toBeInTheDocument();
  });

  it("handles missing IDs and successful privacy-safe certificate PDF downloads", async () => {
    const createObjectURL = vi.fn(() => "blob:coverage");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: new Blob(["pdf"]) });

    render(
      <ToastProvider>
        <DownloadHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Missing" }));
    expect(screen.getByText("Download failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:coverage");
    expect(screen.getByText("Certificate downloaded")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
  });
});
