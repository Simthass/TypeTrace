import { useState } from "react";
import { colors, brand } from "../styles/colors";

// ─── mock data cos the backend PDF generator isnt hooked up yet ───────────────
const mockCertificates = [
  {
    id: "cert_1",
    sessionTitle: "Cloud Computing Essay",
    hash: "a3f5b8c2d94e1f07a3f5b8c2d94e1f07a3f5b8c2d94e1f07",
    date: "May 13, 2026",
    status: "VALID",
    score: 96.3,
  },
  {
    id: "cert_3",
    sessionTitle: "Literature Review — AI",
    hash: "e9d71f5ee10cb219e9d71f5ee10cb219e9d71f5ee10cb219",
    date: "Apr 26, 2026",
    status: "VALID",
    score: 98.1,
  },
  {
    id: "cert_4",
    sessionTitle: "Final Year Project Report",
    hash: "8f4e2a1b9c7d5e6f8f4e2a1b9c7d5e6f8f4e2a1b9c7d5e6f",
    date: "Apr 21, 2026",
    status: "VALID",
    score: 94.7,
  },
  {
    id: "cert_6",
    sessionTitle: "Ethics in Tech Essay",
    hash: "7c5b3a2d1e0f9c8d7c5b3a2d1e0f9c8d7c5b3a2d1e0f9c8d",
    date: "Jan 10, 2026",
    status: "VALID",
    score: 91.2,
  },
];

// ─── icons (bumped up by 2px as requested earlier) ────────────────────────────
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function FilePdfIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15v-4" />
      <path d="M12 15v-4" />
      <path d="M15 15v-4" />
    </svg>
  );
}

export default function CertificatesPage() {
  const [search, setSearch] = useState("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const filtered = mockCertificates.filter((c) =>
    c.sessionTitle.toLowerCase().includes(search.toLowerCase()),
  );

  // little ux trick to show "Copied!" when they click the hash
  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight mb-1"
          style={{ color: colors.text.primary }}
        >
          Certificates
        </h1>
        <p className="text-[14px]" style={{ color: colors.text.secondary }}>
          View and download your cryptographically sealed biometric
          certificates.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[400px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search certificates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          />
        </div>
      </div>

      {/* ── Content Area ── */}
      {filtered.length === 0 ? (
        <div
          className="py-20 text-center border rounded-md border-dashed bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          <p className="text-[14px]" style={{ color: colors.text.secondary }}>
            No certificates found matching "{search}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((cert) => (
            <div
              key={cert.id}
              // using strict rounded-md and exact border colors like vercel
              className="bg-white border rounded-md shadow-sm p-0 flex flex-col overflow-hidden hover:shadow-md transition-shadow group"
              style={{ borderColor: colors.surface[200] }}
            >
              {/* Document Header Area */}
              <div
                className="p-5 border-b flex items-start justify-between"
                style={{
                  borderColor: colors.surface[200],
                  backgroundColor: colors.surface[50],
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="p-2 rounded-md bg-white border shrink-0"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.secondary,
                    }}
                  >
                    <FilePdfIcon />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[14px] font-semibold truncate"
                      style={{ color: colors.text.primary }}
                      title={cert.sessionTitle}
                    >
                      {cert.sessionTitle}
                    </span>
                    <span
                      className="text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      Generated {cert.date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cryptographic Hash Area */}
              <div className="p-5 flex flex-col gap-4 flex-1 bg-white">
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    Cryptographic Seal (SHA-256)
                  </span>

                  {/* Hash code block */}
                  <div
                    className="flex items-center justify-between p-2 rounded-md border bg-surface-50 cursor-pointer hover:bg-surface-100 transition-colors"
                    style={{ borderColor: colors.surface[200] }}
                    onClick={() => handleCopy(cert.hash)}
                    title="Click to copy full hash"
                  >
                    <span
                      className="text-[11px] font-mono truncate"
                      style={{ color: colors.text.primary }}
                    >
                      {/* slicing the hash so it doesnt ruin the flexbox layout */}
                      {cert.hash.slice(0, 24)}...
                    </span>
                    <span
                      className="shrink-0 ml-2"
                      style={{ color: colors.text.secondary }}
                    >
                      {copiedHash === cert.hash ? (
                        <span className="text-[10px] font-semibold text-green-600">
                          Copied!
                        </span>
                      ) : (
                        <CopyIcon />
                      )}
                    </span>
                  </div>
                </div>

                {/* Score & Status Row */}
                <div className="flex items-end justify-between mt-auto pt-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: colors.text.secondary }}
                    >
                      ML Verification
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: brand.humanAccent }}>
                        <ShieldCheckIcon />
                      </span>
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {cert.score}% Human
                      </span>
                    </div>
                  </div>

                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors border"
                    style={{
                      backgroundColor: "#fff",
                      color: colors.text.primary,
                      borderColor: colors.surface[200],
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        colors.surface[50])
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#fff")
                    }
                  >
                    <DownloadIcon />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
