"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[PageError] Page segment crashed:", error?.message)
    console.error("[PageError] Digest:", error?.digest)
    console.error("[PageError] Stack:", error?.stack)
    console.error("[PageError] Full error object:", error)
  }, [error])

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "480px", width: "100%" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            fontSize: 24,
          }}
        >
          ⚠️
        </div>
        <h2 style={{ color: "#111827", marginBottom: "0.5rem", fontSize: "1.125rem" }}>
          Something went wrong
        </h2>
        <p style={{ color: "#6b7280", marginBottom: "0.5rem", fontSize: "0.875rem", lineHeight: 1.6 }}>
          This page ran into an error. Please try refreshing.
        </p>
        {error?.digest && (
          <p style={{ color: "#9ca3af", fontSize: "0.7rem", marginBottom: "1.25rem", fontFamily: "monospace" }}>
            Ref: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              background: "#10B981",
              color: "#fff",
              border: "none",
              borderRadius: "0.75rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "transparent",
              color: "#374151",
              border: "1.5px solid #d1d5db",
              borderRadius: "0.75rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
