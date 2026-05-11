'use client'

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '80px 40px', textAlign: 'center' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#888', marginBottom: '16px' }}>
        Failed to load products
      </p>
      <button
        onClick={reset}
        style={{ padding: '10px 28px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid #222', background: '#fff' }}
      >
        Try again
      </button>
    </div>
  )
}
