// src/hooks/useCertificateDownload.ts
// =============================================================================
// Custom hook that fetches certificate data and generates a PDF using jsPDF.
// jsPDF is already in your project's dependency list (spec section 10.1).
// Install if not already: npm install jspdf
//
// The PDF layout matches the certificate format specified in the project spec
// (section 3.2D) exactly: header, student details, behavioral metrics,
// cryptographic hash, certificate ID, footer.
//
// Usage:
//   const { downloadCertificate, isDownloading } = useCertificateDownload();
//   <button onClick={() => downloadCertificate(sessionId)}>Download PDF</button>
// =============================================================================

import { useState, useCallback } from "react";
import { api } from "../lib/api";

interface CertificateData {
  certificate_id: string;
  document_hash: string;
  issued_at: string;
  student_name: string;
  student_id: string;
  institution: string;
  document_title: string;
  course: string;
  classification: string;
  confidence: number;
  wpm: number;
  duration: string;
  word_count: number;
  total_keystrokes: number;
  deletion_rate: number;
  avg_iki_ms: number;
  pause_count: number;
  verify_url: string;
}

export function useCertificateDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadCertificate = useCallback(
    async (sessionId: number): Promise<void> => {
      setIsDownloading(true);
      try {
        // Fetch full certificate data from the backend
        const res = await api.get<CertificateData>(
          `/sessions/${sessionId}/certificate-data`,
        );
        const data = res.data;

        // Dynamic import so jsPDF is only bundled when actually used
        const { jsPDF } = await import("jspdf");

        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const PAGE_W = 210;
        const MARGIN = 20;
        const CONTENT_W = PAGE_W - MARGIN * 2;
        let y = 0;

        // ── Helper functions ──────────────────────────────────────────────────

        const setFont = (
          style: "normal" | "bold",
          size: number,
          color = "#111827",
        ) => {
          doc.setFont("helvetica", style);
          doc.setFontSize(size);
          const hex = color.replace("#", "");
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          doc.setTextColor(r, g, b);
        };

        const line = (color = "#eaeaea") => {
          const hex = color.replace("#", "");
          doc.setDrawColor(
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
          );
          doc.setLineWidth(0.3);
          doc.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 5;
        };

        const text = (
          str: string,
          x: number,
          align: "left" | "center" | "right" = "left",
        ) => {
          doc.text(str, x, y, { align });
          y += (doc.getLineHeight() / doc.internal.scaleFactor) * 0.45;
        };

        const gap = (mm = 5) => {
          y += mm;
        };

        // ── PAGE BACKGROUND ───────────────────────────────────────────────────
        doc.setFillColor(250, 250, 250);
        doc.rect(0, 0, 210, 297, "F");

        // ── HEADER BAR ────────────────────────────────────────────────────────
        doc.setFillColor(17, 24, 39); // colors.text.primary
        doc.rect(0, 0, 210, 28, "F");

        y = 11;
        setFont("bold", 16, "#ffffff");
        text("TYPETRACE", PAGE_W / 2, "center");
        y = 20;
        setFont("normal", 8, "#9ca3af");
        text(
          "Behavioral Authorship Verification Platform",
          PAGE_W / 2,
          "center",
        );

        y = 35;

        // ── CERTIFICATE TITLE ─────────────────────────────────────────────────
        setFont("bold", 14, "#111827");
        text("CERTIFICATE OF AUTHENTICITY", PAGE_W / 2, "center");
        gap(2);
        line();

        // ── STUDENT BLOCK ─────────────────────────────────────────────────────
        setFont("bold", 10, "#6b7280");
        text("ISSUED TO", MARGIN);
        gap(1);
        setFont("bold", 13, "#111827");
        text(data.student_name, MARGIN);
        gap(1);
        setFont("normal", 9, "#6b7280");
        text(`Student ID: ${data.student_id}  ·  ${data.institution}`, MARGIN);
        gap(4);
        line();

        // ── DOCUMENT BLOCK ────────────────────────────────────────────────────
        setFont("bold", 10, "#6b7280");
        text("DOCUMENT", MARGIN);
        gap(1);
        setFont("bold", 12, "#111827");
        text(data.document_title, MARGIN);
        gap(1);
        setFont("normal", 9, "#6b7280");
        text(`Course: ${data.course}  ·  Issued: ${data.issued_at}`, MARGIN);
        gap(4);
        line();

        // ── BEHAVIORAL METRICS TABLE ──────────────────────────────────────────
        setFont("bold", 10, "#6b7280");
        text("BEHAVIORAL METRICS", MARGIN);
        gap(3);

        const metrics: [string, string][] = [
          [
            "Classification",
            `${data.classification}  (${data.confidence}% confidence)`,
          ],
          ["Net WPM", `${data.wpm} words/minute`],
          ["Session Duration", data.duration],
          ["Word Count (est.)", `${data.word_count} words`],
          ["Total Keystrokes", data.total_keystrokes.toLocaleString()],
          ["Deletion Rate", `${data.deletion_rate}%`],
          ["Mean IKI", `${data.avg_iki_ms}ms`],
          ["Cognitive Pauses", `${data.pause_count}`],
        ];

        // Two-column layout
        const colW = CONTENT_W / 2;
        metrics.forEach(([label, value], i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const xBase = MARGIN + col * colW;
          const yPos = y + row * 10;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.text(label.toUpperCase(), xBase, yPos);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(17, 24, 39);
          doc.text(value, xBase, yPos + 4);
        });

        y += Math.ceil(metrics.length / 2) * 10 + 5;
        line();

        // ── CRYPTOGRAPHIC SECTION ─────────────────────────────────────────────
        setFont("bold", 10, "#6b7280");
        text("CRYPTOGRAPHIC VERIFICATION", MARGIN);
        gap(2);

        // Hash block — gray box
        doc.setFillColor(244, 244, 245);
        doc.setDrawColor(234, 234, 234);
        doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, "FD");
        y += 4;
        setFont("bold", 7.5, "#6b7280");
        text("SHA-256 HASH", MARGIN + 3);
        y -= 1;
        setFont("normal", 7.5, "#111827");
        // Break hash into two lines if too long
        const hashParts = [
          data.document_hash.slice(0, 32),
          data.document_hash.slice(32),
        ];
        doc.text(hashParts[0], MARGIN + 3, y);
        y += 3.5;
        doc.text(hashParts[1] || "", MARGIN + 3, y);
        y += 5;
        gap(3);

        // Certificate ID
        setFont("bold", 10, "#6b7280");
        text("CERTIFICATE ID", MARGIN);
        gap(1);
        setFont("bold", 11, "#111827");
        text(data.certificate_id, MARGIN);
        gap(2);

        // Verify URL
        setFont("normal", 8, "#6b7280");
        text(
          `Verify online: ${window.location.origin}${data.verify_url}`,
          MARGIN,
        );
        gap(4);
        line();

        // ── LEGAL FOOTER ──────────────────────────────────────────────────────
        setFont("normal", 7.5, "#9ca3af");
        const footerLines = [
          "This certificate verifies that the above document was typed by a human as determined by TypeTrace behavioral",
          "keystroke analysis. The SHA-256 hash cryptographically seals the session data — any tampering invalidates",
          "this certificate. TypeTrace is a behavioral evidence platform; this certificate should be used alongside",
          "other supporting evidence in formal academic integrity proceedings.",
        ];
        footerLines.forEach((fl) => {
          text(fl, PAGE_W / 2, "center");
          gap(0.5);
        });

        gap(3);

        // ── FOOTER BAR ────────────────────────────────────────────────────────
        const footerY = 285;
        doc.setFillColor(244, 244, 245);
        doc.rect(0, footerY, 210, 12, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text(
          "TypeTrace — Behavioral Authorship Verification",
          MARGIN,
          footerY + 5,
        );
        doc.text(
          `Generated: ${new Date().toUTCString()}`,
          PAGE_W - MARGIN,
          footerY + 5,
          { align: "right" },
        );

        // ── SAVE ──────────────────────────────────────────────────────────────
        const filename = `TypeTrace_Certificate_${data.certificate_id}.pdf`;
        doc.save(filename);
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { detail?: string } } };
        alert(
          ax.response?.data?.detail ??
            "Failed to generate certificate PDF. Please try again.",
        );
        console.error("Certificate download failed:", err);
      } finally {
        setIsDownloading(false);
      }
    },
    [],
  );

  return { downloadCertificate, isDownloading };
}
