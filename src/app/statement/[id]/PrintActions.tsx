'use client'

export default function PrintActions() {
  return (
    <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 99 }}>
      <button
        onClick={() => window.print()}
        style={{ background: '#C09428', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
        🖨 Print / Save PDF
      </button>
      <button
        onClick={() => window.history.back()}
        style={{ background: '#fff', color: '#7A6A5A', border: '1px solid #E5DDD0', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
        ← Back
      </button>
    </div>
  )
}
