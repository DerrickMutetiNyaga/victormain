"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalError] Root layout crashed:", error?.message)
    console.error("[GlobalError] Digest:", error?.digest)
    console.error("[GlobalError] Stack:", error?.stack)
  }, [error])

  return (
    <html>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            maxWidth: "480px",
            width: "100%",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: 28,
            }}
          >
            ⚠️
          </div>
          <h2 style={{ color: "#111827", marginBottom: "0.75rem", fontSize: "1.25rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            The page encountered an unexpected error. This has been logged for review.
          </p>
          {error?.digest && (
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "1.5rem", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#10B981",
              color: "#fff",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.75rem 2rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
