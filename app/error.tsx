"use client"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 16 }}>
      <h2>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error?.message || error)}</pre>
      <button onClick={() => reset()} style={{ marginTop: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}>
        Try again
      </button>
    </div>
  )
}

