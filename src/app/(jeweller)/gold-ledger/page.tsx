'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const GRM  = (n: number) => n.toFixed(3) + 'g'
const FD   = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function GoldLedgerPage() {
  const supabase  = createClient()
  const router    = useRouter()
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments,    setPayments]    = useState<any[]>([])
  const [goldRates,   setGoldRates]   = useState<any[]>([])
  const [ledger,      setLedger]      = useState<any[]>([])
  const [tenantId,    setTenantId]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<'overview'|'schedule'|'entries'>('overview')
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [form,        setForm]        = useState({ entry_date: new Date().toISOString().split('T')[0], entry_type: 'purchase', grams: '', rate_22k: '', notes: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id; setTenantId(tid)
    const [{ data: en }, { data: pa }, { data: gr }, { data: gl }] = await Promise.all([
      supabase.from('enrollments').select('id,enrollment_id,customer_id,monthly_amount,signup_date,scheme_duration_months,status').eq('tenant_id', tid).eq('status', 'active'),
      supabase.from('payments').select('enrollment_id,customer_id,amount_received,payment_date').eq('tenant_id', tid),
      supabase.from('gold_rates').select('*').eq('tenant_id', tid).order('date', { ascending: false }).limit(1),
      supabase.from('gold_ledger').select('*').eq('tenant_id', tid).order('entry_date', { ascending: false }),
    ])
    setEnrollments(en ?? [])
    setPayments(pa ?? [])
    setGoldRates(gr ?? [])
    setLedger(gl ?? [])
    setLoading(false)
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const grams  = parseFloat(form.grams)
    const rate   = form.rate_22k ? parseFloat(form.rate_22k) : null
    await supabase.from('gold_ledger').insert({
      tenant_id:  tenantId,
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      grams:      form.entry_type === 'payout' ? -grams : grams,
      rate_22k:   rate,
      amount:     rate ? Math.round(grams * rate) : null,
      notes:      form.notes || null,
    })
    setSaving(false); setShowForm(false); setForm({ entry_date: new Date().toISOString().split('T')[0], entry_type: 'purchase', grams: '', rate_22k: '', notes: '' }); load()
  }

  const rate22k = goldRates[0]?.rate_22k ?? 0

  // ── Calculations ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalMRR         = enrollments.reduce((s, e) => s + e.monthly_amount, 0)
    const totalCommitted   = enrollments.reduce((s, e) => s + (e.scheme_duration_months || 11) * e.monthly_amount + e.monthly_amount, 0) // incl bonus month
    const totalCollected   = payments.reduce((s, p) => s + p.amount_received, 0)
    const stillToReceive   = Math.max(0, totalCommitted - totalCollected)
    const goldCommitted    = rate22k > 0 ? stillToReceive / rate22k : 0
    const goldNeededMo     = rate22k > 0 ? totalMRR / rate22k : 0

    // Physical gold position from ledger
    const goldPurchased = ledger.filter(l => l.entry_type !== 'payout').reduce((s, l) => s + (l.grams || 0), 0)
    const goldPaidOut   = ledger.filter(l => l.entry_type === 'payout').reduce((s, l) => s + Math.abs(l.grams || 0), 0)
    const goldOnHand    = goldPurchased - goldPaidOut

    return { totalMRR, totalCommitted, totalCollected, stillToReceive, goldCommitted, goldNeededMo, goldOnHand, goldPurchased, goldPaidOut }
  }, [enrollments, payments, ledger, rate22k])

  // ── Month-wise payout schedule ────────────────────────────────────
  const schedule = useMemo(() => {
    const today  = new Date(); today.setHours(0,0,0,0)
    const months: Record<string, { completions: number; payout: number; enrollments: number }> = {}

    for (const e of enrollments) {
      const signup    = new Date(e.signup_date + 'T00:00:00')
      const duration  = e.scheme_duration_months || 11
      const maturity  = new Date(signup.getFullYear(), signup.getMonth() + duration, signup.getDate())
      const yearMonth = `${maturity.getFullYear()}-${String(maturity.getMonth()+1).padStart(2,'0')}`

      if (!months[yearMonth]) months[yearMonth] = { completions: 0, payout: 0, enrollments: 0 }
      months[yearMonth].completions++
      months[yearMonth].payout += (duration + 1) * e.monthly_amount // including bonus
    }

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 12)
      .map(([ym, data]) => {
        const [yr, mo] = ym.split('-').map(Number)
        const goldNeeded = rate22k > 0 ? data.payout / rate22k : 0
        const isPast     = new Date(yr, mo - 1) < today
        return { ym, month: `${MONTHS[mo-1]} ${yr}`, ...data, goldNeeded, isPast }
      })
  }, [enrollments, rate22k])

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  if (loading) return <div style={{ padding: 40, color: MUTED }}>Loading…</div>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Gold Commitment Ledger</h1>
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>
            Know exactly how much gold you are committed to pay out — and how much to buy each month
            {rate22k > 0 && <span> · 22K rate: <strong style={{ color: GOLD }}>{INR(rate22k)}/g</strong></span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          + Log Gold Entry
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: '#fff', padding: 4, borderRadius: 10, border: BORDER, width: 'fit-content' }}>
        {[['overview','Overview'],['schedule','Payout Schedule'],['entries','Ledger Entries']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v as any)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab===v ? 700 : 400, background: tab===v ? '#1B1108' : 'transparent', color: tab===v ? '#fff' : MUTED }}>
            {l}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Monthly Collection (MRR)', value: INR(metrics.totalMRR), sub: `${enrollments.length} active schemes`, color: GOLD },
              { label: 'Total Committed Payout', value: INR(metrics.totalCommitted), sub: 'at all scheme maturities', color: TEXT },
              { label: 'Total Collected So Far', value: INR(metrics.totalCollected), sub: 'across all payments', color: '#1A7A3A' },
              { label: 'Still to Pay Out', value: INR(metrics.stillToReceive), sub: 'outstanding liability', color: metrics.stillToReceive > 0 ? '#C05000' : '#1A7A3A' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: c.color, marginBottom: 4 }}>{c.value}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Gold metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Gold Committed (Outstanding)', value: rate22k > 0 ? GRM(metrics.goldCommitted) : '—', sub: rate22k > 0 ? `at ${INR(rate22k)}/g (22K)` : 'Enter today\'s gold rate first', color: GOLD, icon: '🥇' },
              { label: 'Monthly Gold to Buy', value: rate22k > 0 ? GRM(metrics.goldNeededMo) : '—', sub: rate22k > 0 ? `Procure ${GRM(metrics.goldNeededMo)} every month to stay covered` : 'Set gold rate first', color: TEXT, icon: '📦' },
              { label: 'Physical Gold on Hand', value: ledger.length > 0 ? GRM(metrics.goldOnHand) : 'Not tracked yet', sub: ledger.length > 0 ? `${GRM(metrics.goldPurchased)} purchased · ${GRM(metrics.goldPaidOut)} paid out` : 'Use "Log Gold Entry" to track', color: metrics.goldOnHand > metrics.goldCommitted ? '#1A7A3A' : '#C05000', icon: '⚖️' },
            ].map(c => (
              <div key={c.label} style={{ background: '#FBF8F0', borderRadius: 12, border: `1px solid ${GOLD}33`, padding: '20px 22px' }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: c.color, marginBottom: 4 }}>{c.value}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Coverage indicator */}
          {ledger.length > 0 && rate22k > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '20px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Gold Coverage</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginBottom: 6 }}>
                <span>On hand: {GRM(metrics.goldOnHand)}</span>
                <span>Committed: {GRM(metrics.goldCommitted)}</span>
              </div>
              <div style={{ height: 12, background: '#F0EAE0', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${Math.min(100, metrics.goldCommitted > 0 ? (metrics.goldOnHand / metrics.goldCommitted) * 100 : 0)}%`, background: metrics.goldOnHand >= metrics.goldCommitted ? '#1A7A3A' : GOLD, borderRadius: 10 }} />
              </div>
              <div style={{ fontSize: 12.5, color: metrics.goldOnHand >= metrics.goldCommitted ? '#1A7A3A' : '#C05000', fontWeight: 600 }}>
                {metrics.goldOnHand >= metrics.goldCommitted
                  ? `✓ Fully covered — ${GRM(metrics.goldOnHand - metrics.goldCommitted)} surplus`
                  : `⚠ Short by ${GRM(metrics.goldCommitted - metrics.goldOnHand)} — buy ${GRM(metrics.goldNeededMo)} this month`}
              </div>
            </div>
          )}
        </>
      )}

      {/* Payout Schedule tab */}
      {tab === 'schedule' && (
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Month', 'Completions', 'Payout Value', 'Gold Needed (22K)', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {schedule.length === 0
                ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: MUTED }}>No active enrollments.</td></tr>
                : schedule.map(s => (
                  <tr key={s.ym} style={{ background: s.isPast ? '#F9F9F9' : '#fff' }}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: s.isPast ? MUTED : TEXT, opacity: s.isPast ? 0.6 : 1 }}>{s.month}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 18, fontFamily: 'var(--font-cormorant), serif', color: TEXT }}>{s.completions}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: GOLD }}>{INR(s.payout)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontWeight: 600 }}>{rate22k > 0 ? GRM(s.goldNeeded) : '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, background: s.isPast ? '#F5F5F5' : '#FBF8F0', color: s.isPast ? MUTED : GOLD }}>
                        {s.isPast ? 'Past' : 'Upcoming'}
                      </span>
                    </td>
                  </tr>
                ))}
              {/* Total row */}
              {schedule.length > 0 && (
                <tr style={{ background: '#F5F0E6', fontWeight: 700 }}>
                  <td style={{ padding: '11px 14px', color: TEXT, fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '11px 14px', color: TEXT }}>{schedule.reduce((s, m) => s + m.completions, 0)}</td>
                  <td style={{ padding: '11px 14px', color: GOLD }}>{INR(schedule.reduce((s, m) => s + m.payout, 0))}</td>
                  <td style={{ padding: '11px 14px', color: TEXT }}>{rate22k > 0 ? GRM(schedule.reduce((s, m) => s + m.goldNeeded, 0)) : '—'}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ledger Entries tab */}
      {tab === 'entries' && (
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Date', 'Type', 'Grams', '22K Rate', 'Amount', 'Notes'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ledger.length === 0
                ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No entries yet. Click "+ Log Gold Entry" to start tracking.</td></tr>
                : ledger.map(l => (
                  <tr key={l.id}>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT }}>{FD(l.entry_date)}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                        background: l.entry_type==='purchase' ? '#F0FFF4' : l.entry_type==='payout' ? '#FEE2E2' : '#FBF8F0',
                        color:      l.entry_type==='purchase' ? '#1A7A3A' : l.entry_type==='payout' ? '#C03030' : MUTED }}>
                        {l.entry_type}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: l.grams >= 0 ? '#1A7A3A' : '#C03030' }}>
                      {l.grams >= 0 ? '+' : ''}{parseFloat(l.grams).toFixed(3)}g
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 13 }}>{l.rate_22k ? INR(l.rate_22k) : '—'}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{l.amount ? INR(l.amount) : '—'}</td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 13 }}>{l.notes || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Gold Entry Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Log Gold Entry</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Lbl t="Date" /><input type="date" required value={form.entry_date} onChange={e => setForm({...form, entry_date: e.target.value})} style={inp} /></div>
                <div>
                  <Lbl t="Entry Type" />
                  <select style={inp} value={form.entry_type} onChange={e => setForm({...form, entry_type: e.target.value})}>
                    <option value="purchase">Purchase (bought gold)</option>
                    <option value="payout">Payout (scheme closure)</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                </div>
                <div><Lbl t="Grams" /><input type="number" step="0.001" required placeholder="e.g. 10.500" value={form.grams} onChange={e => setForm({...form, grams: e.target.value})} style={inp} /></div>
                <div><Lbl t="22K Rate (optional)" /><input type="number" placeholder="e.g. 6200" value={form.rate_22k} onChange={e => setForm({...form, rate_22k: e.target.value})} style={inp} /></div>
              </div>
              <div><Lbl t="Notes (optional)" /><input type="text" placeholder="e.g. Bought from Zaveri Bazaar" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={inp} /></div>
              {form.grams && form.rate_22k && (
                <div style={{ padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 13.5, fontWeight: 700, color: GOLD }}>
                  Value: {INR(parseFloat(form.grams) * parseFloat(form.rate_22k))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '11px 18px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
