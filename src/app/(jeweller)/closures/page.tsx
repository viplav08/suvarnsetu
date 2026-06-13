'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INR = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD  = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

export default function ClosuresPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments,    setPayments]    = useState<any[]>([])
  const [goldRates,   setGoldRates]   = useState<any[]>([])
  const [closures,    setClosures]    = useState<any[]>([])
  const [showModal, setShowModal]     = useState(false)
  const [eid, setEid]                 = useState('')
  const [reason, setReason]           = useState('completed')
  const [bonusApplied, setBonusApplied] = useState(false)
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState<any>(null)
  const [lastId, setLastId]           = useState<string|null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id; setTenantId(tid)
    const [en, p, g, cl] = await Promise.all([
      supabase.from('enrollments').select('*, customers(full_name, customer_id, mobile, signup_date)').eq('tenant_id', tid).eq('status', 'active'),
      supabase.from('payments').select('*').eq('tenant_id', tid),
      supabase.from('gold_rates').select('*').eq('tenant_id', tid).order('date', { ascending: false }),
      supabase.from('account_closures').select('*, enrollments(enrollment_id, monthly_amount, signup_date, customers(full_name, customer_id))').eq('tenant_id', tid).order('created_at', { ascending: false }),
    ])
    setEnrollments(en.data ?? [])
    setPayments(p.data ?? [])
    setGoldRates(g.data ?? [])
    setClosures(cl.data ?? [])
    setLoading(false)
  }

  const sel      = enrollments.find((e: any) => e.id === eid)
  const selPay   = sel ? payments.filter((p: any) => p.enrollment_id === sel.id || p.customer_id === sel.customer_id) : []
  const totalPaid  = selPay.reduce((s: number, p: any) => s + p.amount_received, 0)
  const monthsPaid = selPay.reduce((s: number, p: any) => s + (p.months_paid_for || 1), 0)
  const goldRate   = goldRates.find((r: any) => r.date === closureDate) ?? goldRates[0]
  const bonusAmt   = bonusApplied && sel ? sel.monthly_amount : 0
  const finalAmt   = totalPaid + bonusAmt

  async function handleClose(e: React.FormEvent) {
    e.preventDefault(); if (!sel) return; setSaving(true)
    const { data: inserted, error } = await supabase.from('account_closures').insert({
      tenant_id: tenantId, customer_id: sel.customer_id, enrollment_id: sel.id,
      closure_date: closureDate, reason, bonus_applied: bonusApplied,
      total_amount_paid: totalPaid, months_paid: monthsPaid, final_amount: finalAmt,
      gold_rate_22k: goldRate?.rate_22k ?? null, gold_rate_24k: goldRate?.rate_24k ?? null,
      gold_grams: goldRate ? parseFloat((finalAmt / goldRate.rate_22k).toFixed(3)) : null,
    }).select().single()
    if (!error && inserted) {
      await supabase.from('enrollments').update({ status: reason }).eq('id', sel.id)
      setLastId(inserted.id)
      setDone({ name: sel.customers?.full_name, enrollId: sel.enrollment_id, totalPaid, monthsPaid, bonusAmt, finalAmt, reason })
      loadAll()
    } else if (error) alert(error.message)
    setSaving(false)
  }

  const Lbl = ({ t }: { t: string }) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>
  )

  if (loading) return <div style={{ padding: '36px 40px', color: MUTED }}>Loading closures…</div>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Account Closures</h1>
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{closures.length} closure{closures.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEid(''); setReason('completed'); setBonusApplied(false); setClosureDate(new Date().toISOString().split('T')[0]); setDone(null); setLastId(null); setShowModal(true) }}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
          + Close Account
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Customer','Enrollment','Reason','Date','Total Paid','Bonus','Final','Gold (g)',''].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {closures.length === 0
              ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: MUTED }}>No accounts closed yet.</td></tr>
              : closures.map((cl: any) => (
                <tr key={cl.id}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <div style={{ fontWeight: 600, color: TEXT }}>{cl.enrollments?.customers?.full_name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{cl.enrollments?.customers?.customer_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{cl.enrollments?.enrollment_id}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, border: BORDER, color: MUTED, textTransform: 'capitalize' }}>{cl.reason}</span>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{FD(cl.closure_date)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(cl.total_amount_paid)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 13 }}>{cl.bonus_applied ? INR(cl.final_amount - cl.total_amount_paid) : '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: TEXT }}>{INR(cl.final_amount)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{cl.gold_grams ? cl.gold_grams.toFixed(3) + 'g' : '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <button onClick={() => window.open(`/closures/print/${cl.id}`, '_blank')}
                      style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🖨 PDF</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 24, fontWeight: 600, color: TEXT }}>{done ? 'Account Closed ✓' : 'Close Account'}</h2>
              <button onClick={() => { setShowModal(false); setDone(null) }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            {done ? (
              <div>
                {[['Customer', done.name], ['Enrollment', done.enrollId], ['Total Paid', INR(done.totalPaid)], ['Months', String(done.monthsPaid)], ['Bonus', done.bonusAmt > 0 ? INR(done.bonusAmt) : 'Not applied'], ['Final Amount', INR(done.finalAmt)], ['Reason', done.reason]].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: BORDER, fontSize: 13 }}>
                    <span style={{ color: MUTED }}>{k}</span>
                    <span style={{ fontWeight: 600, color: TEXT, textTransform: 'capitalize' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  {lastId && <button onClick={() => window.open(`/closures/print/${lastId}`, '_blank')}
                    style={{ flex: 1, background: '#FBF8F0', color: GOLD, border: `1.5px solid ${GOLD}`, padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>🖨 Download PDF</button>}
                  <button onClick={() => { setShowModal(false); setDone(null) }}
                    style={{ flex: 1, background: GOLD, color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Lbl t="Select Enrollment" />
                  <select required value={eid} onChange={e => setEid(e.target.value)}
                    style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff' }}>
                    <option value="">— Select active enrollment —</option>
                    {enrollments.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.customers?.full_name} — {e.enrollment_id} ({INR(e.monthly_amount)}/mo)</option>
                    ))}
                  </select>
                </div>
                {sel && (
                  <div style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                      {[['Months Paid', monthsPaid + ' mo'], ['Total Collected', INR(totalPaid)], ['Bonus', bonusApplied ? INR(bonusAmt) : 'Not applied'], ['Final', INR(finalAmt)]].map(([k,v]) => (
                        <div key={k}><div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 2 }}>{k}</div><div style={{ fontSize: 14, fontWeight: 700, color: k === 'Final' ? GOLD : TEXT }}>{v}</div></div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Lbl t="Closure Date" /><input type="date" value={closureDate} onChange={e => setClosureDate(e.target.value)} style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} /></div>
                  <div><Lbl t="Reason" />
                    <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff' }}>
                      <option value="completed">Completed</option><option value="redeemed">Redeemed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 13.5, color: TEXT }}>
                  <input type="checkbox" checked={bonusApplied} onChange={e => setBonusApplied(e.target.checked)} style={{ width: 15, height: 15 }} />
                  Apply 1-month bonus {sel && bonusApplied && <span style={{ marginLeft: 'auto', fontWeight: 700, color: GOLD }}>{INR(sel.monthly_amount)}</span>}
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={!sel || saving}
                    style={{ flex: 1, background: !sel || saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '11px', borderRadius: 8, cursor: !sel ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                    {saving ? 'Closing...' : 'Confirm & Close'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '11px 18px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
