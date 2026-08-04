"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <style>{`
          @keyframes bm-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
          @keyframes bm-pop { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: scale(1) } }
          @keyframes bm-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
          @media (prefers-reduced-motion: reduce) {
            .bm-rise, .bm-pop, .bm-breathe { animation: none !important }
          }
        `}</style>
        <div
          className="bm-rise"
          style={{ maxWidth: "32rem", textAlign: "center", animation: "bm-rise .4s ease-out both" }}
        >
          <div
            className="bm-pop"
            style={{
              width: "3.5rem",
              height: "3.5rem",
              margin: "0 auto 1.25rem",
              borderRadius: "1rem",
              background: "#fee2e2",
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: 700,
              animation: "bm-pop .45s cubic-bezier(.22,1,.36,1) both, bm-breathe 2.4s ease-in-out .5s infinite",
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Bulk Mapper couldn&apos;t start
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#475569", lineHeight: 1.6 }}>
            Something failed before the app could load. Reloading usually fixes it. Nothing you
            uploaded has been sent anywhere.
          </p>
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={reset}
              style={{
                height: "2.75rem",
                padding: "0 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                height: "2.75rem",
                padding: "0 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#0f172a",
                fontSize: "0.875rem",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Reload the app
            </a>
          </div>
          <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#64748b" }}>
            If it keeps happening, let your administrator know.
          </p>
        </div>
      </body>
    </html>
  );
}
