"use client"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif' }}>
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}>
            {String(error?.message || error)}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

