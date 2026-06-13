'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD   = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function MiniChart({ rates, type }: { rates: any[]; type: '22k' | '24k' }) {
  if (rates.length < 2) return null
  const field   = type === '22k' ? 'rate_22k' : 'rate_24k'
  const vals    = rates.map(r => r[field]).filter(Boolean)
  const minVal  = Math.min(...vals)
  const maxVal  = Math.max(...vals)
  const range   = maxVal - minVal || 1
  const W = 340, H = 80, PAD = { top: 8, right: 8, bottom: 20, left: 48 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top  - PAD.bottom

  const points = rates
    .filter(r => r[field])
    .map((r, i, arr) => {
      const x = PAD.left + (i / (arr.length - 1)) * cW
      const y = PAD.top  + cH - ((r[field] - minVal) / range) * cH
      return `${x},${y}`
    }).join(' ')

  const last     = rates.filter(r => r[field]).slice(-1)[0]
  const prev     = rates.filter(r => r[field]).slice(-2)[0]
  const change   = last && prev ? last[field] - prev[field] : 0
  const isUp     = change >= 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {type === '22k' ? '22 Karat' : '24 Karat'} — 30 Day Trend
        </div>
        {change !== 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: isUp ? '#C03030' : '#1A7A3A' }}>
            {isUp ? '▲' : '▼'} {INR(Math.abs(change))}
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        {[0, 50, 100].map(pct => {
          const y = PAD.top + cH * (1 - pct/100)
          const val = minVal + (range * pct/100)
          return (
            <g key={pct}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F0EAE0" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill={MUTED}>{INR(val)}</text>
            </g>
          )
        })}
        {/* Line */}
        <polyline points={points} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" />
        {/* End dot */}
        {(() => {
          const lastPt = points.split(' ').pop()
          if (!lastPt) return null
          const [x, y] = lastPt.split(',').map(Number)
          return <circle cx={x} cy={y} r="3" fill={GOLD} />
        })()}
        {/* X axis labels — first and last date */}
        {rates.length > 0 && (() => {
          const first = rates[0]
          const last  = rates[rates.length - 1]
          return (
            <>
              <text x={PAD.left} y={H - 2} fontSize="9" fill={MUTED}>{first.date ? new Date(first.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : ''}</text>
              <text x={W - PAD.right} y={H - 2} textAnchor="end" fontSize="9" fill={MUTED}>{last.date ? new Date(last.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : ''}</text>
            </>
          )
        })()}
      </svg>
    </div>
  )
}

export default function GoldRatePage() {
  const supabase = createClient()
  const router   = useRouter()
  const [rates,   setRates]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [form,    setForm]    = useState({ date: new Date().toISOString().split('T')[0], rate_22k: '', rate_24k: '' })
  const [saving,  setSaving]  = useState(false)
  const [editId,  setEditId]  = useState<string|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id; setTenantId(tid)
    const { data } = await supabase.from('gold_rates').select('*').eq('tenant_id', tid).order('date', { ascending: false })
    setRates(data ?? []); setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    if (editId) {
      await supabase.from('gold_rates').update({ rate_22k: parseFloat(form.rate_22k), rate_24k: parseFloat(form.rate_24k) }).eq('id', editId)
      setEditId(null)
    } else {
      const existing = rates.find(r => r.date === form.date)
      if (existing) {
        await supabase.from('gold_rates').update({ rate_22k: parseFloat(form.rate_22k), rate_24k: parseFloat(form.rate_24k) }).eq('id', existing.id)
      } else {
        await supabase.from('gold_rates').insert({ tenant_id: tenantId, date: form.date, rate_22k: parseFloat(form.rate_22k), rate_24k: parseFloat(form.rate_24k) })
      }
    }
    setSaving(false)
    setForm({ date: new Date().toISOString().split('T')[0], rate_22k: '', rate_24k: '' })
    load()
  }

  const latest    = rates[0]
  const chartData = [...rates].reverse().slice(-30)
  const inp: React.CSSProperties = { border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' }

  if (loading) return <div style={{ padding: 40, color: MUTED }}>Loading…</div>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Gold Rate</h1>
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Daily gold prices — used for closure calculations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Rate entry form */}
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 18 }}>
            {editId ? '✎ Edit Rate' : 'Enter Today\'s Rate'}
          </h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</label>
              <input type="date" style={inp} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>22K Rate (₹/g)</label>
                <input type="number" style={inp} placeholder="e.g. 6200" value={form.rate_22k} onChange={e => setForm({ ...form, rate_22k: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>24K Rate (₹/g)</label>
                <input type="number" style={inp} placeholder="e.g. 6780" value={form.rate_24k} onChange={e => setForm({ ...form, rate_24k: e.target.value })} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {saving ? 'Saving…' : editId ? 'Update Rate' : 'Save Rate'}
              </button>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setForm({ date: new Date().toISOString().split('T')[0], rate_22k: '', rate_24k: '' }) }}
                  style={{ padding: '10px 16px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        {/* Latest rate + trend */}
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24 }}>
          {latest ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Latest Rate — {FD(latest.date)}</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div><div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>22K</div><div style={{ fontSize: 24, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: GOLD }}>{INR(latest.rate_22k)}<span style={{ fontSize: 13, color: MUTED }}>/g</span></div></div>
                  <div><div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>24K</div><div style={{ fontSize: 24, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: TEXT }}>{INR(latest.rate_24k)}<span style={{ fontSize: 13, color: MUTED }}>/g</span></div></div>
                </div>
              </div>
              <div style={{ borderTop: BORDER, paddingTop: 14 }}>
                <MiniChart rates={chartData} type="22k" />
              </div>
            </>
          ) : (
            <div style={{ color: MUTED, fontSize: 13.5, fontStyle: 'italic' }}>No rates entered yet.</div>
          )}
        </div>
      </div>

      {/* History table */}
      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Date', '22K (₹/g)', '24K (₹/g)', 'Actions'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rates.length === 0
              ? <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: MUTED }}>No gold rates entered yet.</td></tr>
              : rates.map((r, i) => (
                <tr key={r.id} style={{ background: i === 0 ? '#FBF8F0' : '#fff' }}>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontWeight: i === 0 ? 600 : 400 }}>{FD(r.date)}{i === 0 && <span style={{ marginLeft: 8, fontSize: 10, background: GOLD, color: '#fff', borderRadius: 4, padding: '1px 6px' }}>Latest</span>}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: GOLD }}>{INR(r.rate_22k)}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT }}>{INR(r.rate_24k)}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <button onClick={() => { setEditId(r.id); setForm({ date: r.date, rate_22k: String(r.rate_22k), rate_24k: String(r.rate_24k) }) }}
                      style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>✎ Edit</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
