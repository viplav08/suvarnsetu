'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INR    = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const GOLD   = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const FD     = (d: string) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateStr = (d: any) => !d ? '' : String(d).substring(0, 10)
const todayLocal = () => {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

export default function DailyDuesClient({ dueToday, overdue, tenantId }: any) {
  const router    = useRouter()
  const supabase  = createClient()

  // ── User name (for "followed by" in remarks) ──────────────────────────
  const [userName, setUserName] = useState('')
  useEffect(() => {
    async function loadUserName() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const role = user.app_metadata?.role
      const tid  = user.app_metadata?.tenant_id
      if (role === 'manager') {
        const { data } = await supabase.from('staff').select('name').eq('auth_user_id', user.id).maybeSingle()
        setUserName(data?.name ?? user.email ?? 'Manager')
      } else {
        const { data } = await supabase.from('tenants').select('owner_name').eq('id', tid).maybeSingle()
        setUserName(data?.owner_name ?? user.email ?? 'Admin')
      }
    }
    loadUserName()
  }, [])

  // ── Follow-ups (all for tenant, keyed by enrollment_id) ──────────────
  const [followUps,     setFollowUps]     = useState<Record<string, any[]>>({})
  const [fuLoading,     setFuLoading]     = useState(true)

  useEffect(() => { loadFollowUps() }, [])

  async function loadFollowUps() {
    setFuLoading(true)
    const { data } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    const grouped: Record<string, any[]> = {}
    for (const fu of (data ?? [])) {
      if (!grouped[fu.enrollment_id]) grouped[fu.enrollment_id] = []
      grouped[fu.enrollment_id].push(fu)
    }
    setFollowUps(grouped)
    setFuLoading(false)
  }

  // ── Payment modal ─────────────────────────────────────────────────────
  const [payModal, setPayModal]   = useState<any>(null)
  const [payForm,  setPayForm]    = useState({ months: '1', date: todayLocal(), mode: 'cash', txnId: '', remarks: '' })
  const [savingPay, setSavingPay] = useState(false)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault(); setSavingPay(true)
    const { data: idData } = await supabase.rpc('next_payment_id', { p_tenant_id: tenantId })
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId, payment_id: idData,
      enrollment_id: payModal.enrollment.id, customer_id: payModal.enrollment.customer_id,
      payment_date: payForm.date, months_paid_for: parseInt(payForm.months),
      amount_received: payModal.enrollment.monthly_amount * parseInt(payForm.months),
      payment_mode: payForm.mode,
      transaction_id: payForm.txnId || null, remarks: payForm.remarks || null,
    })
    setSavingPay(false)
    if (!error) {
      setPayModal(null)
      setPayForm({ months: '1', date: todayLocal(), mode: 'cash', txnId: '', remarks: '' })
      router.refresh()
    } else alert(error.message)
  }

  // ── Remark modal ──────────────────────────────────────────────────────
  const [remarkModal,   setRemarkModal]   = useState<any>(null)
  const [remarkText,    setRemarkText]    = useState('')
  const [nextFollowup,  setNextFollowup]  = useState('')
  const [savingRemark,  setSavingRemark]  = useState(false)

  function openRemarkModal(item: any) {
    setRemarkModal(item)
    setRemarkText('')
    setNextFollowup('')
  }

  async function handleAddRemark(e: React.FormEvent) {
    e.preventDefault()
    if (!remarkText.trim()) return
    setSavingRemark(true)
    const { error } = await supabase.from('follow_ups').insert({
      enrollment_id:      remarkModal.enrollment.id,
      tenant_id:          tenantId,
      remark:             remarkText.trim(),
      followed_by:        userName,
      next_followup_date: nextFollowup || null,
      remark_date:        todayLocal(),
    })
    setSavingRemark(false)
    if (!error) {
      setRemarkText('')
      setNextFollowup('')
      await loadFollowUps()
      // Don't close modal — keep it open so they can see the new remark and add more
    } else alert(error.message)
  }

  // ── Table row component ───────────────────────────────────────────────
  function DueRow({ item, showRemarks }: { item: any; showRemarks: boolean }) {
    const eid      = item.enrollment.id
    const fus      = followUps[eid] ?? []
    const latestFu = fus[0]
    const isOverdueForNextFollowup = latestFu?.next_followup_date &&
      new Date(latestFu.next_followup_date + 'T00:00:00') <= new Date()

    return (
      <tr>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ fontWeight: 600, color: TEXT }}>{item.customer?.full_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{item.customer?.customer_id} · {item.enrollment?.enrollment_id}</div>
        </td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{item.customer?.mobile}</td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(item.enrollment?.monthly_amount)}</td>
        {showRemarks && (
          <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
            {item.overdueMonths > 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#C03030' }}>{item.overdueMonths} mo · {item.daysOverdue}d</div>
            )}
          </td>
        )}
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: showRemarks ? '#C03030' : '#856404', fontSize: 13.5 }}>
          {INR(item.pendingAmount)}
        </td>

        {/* Last follow-up info */}
        {showRemarks && (
          <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', maxWidth: 180 }}>
            {latestFu ? (
              <div>
                <div style={{ fontSize: 11.5, color: TEXT, fontWeight: 500, lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 160 }}>
                  {latestFu.remark}
                </div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>
                  {FD(latestFu.remark_date)} · {latestFu.followed_by}
                  {fus.length > 1 && <span style={{ marginLeft: 5, background: '#F5F0E6', color: MUTED, borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>+{fus.length - 1}</span>}
                </div>
                {latestFu.next_followup_date && (
                  <div style={{ fontSize: 10.5, marginTop: 2, color: isOverdueForNextFollowup ? '#C03030' : '#1A5FB4', fontWeight: 600 }}>
                    📅 Follow up: {FD(latestFu.next_followup_date)}{isOverdueForNextFollowup ? ' ⚠' : ''}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 11.5, color: MUTED, fontStyle: 'italic' }}>No follow-up yet</span>
            )}
          </td>
        )}

        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setPayModal(item)}
              style={{ background: GOLD, color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
              ₹ Pay
            </button>
            {showRemarks && (
              <button onClick={() => openRemarkModal(item)}
                style={{ background: fus.length > 0 ? '#1B1108' : 'transparent', color: fus.length > 0 ? '#fff' : MUTED, border: BORDER, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                📝 {fus.length > 0 ? `${fus.length} Note${fus.length > 1 ? 's' : ''}` : 'Remark'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  function Table({ items, showRemarks }: { items: any[]; showRemarks: boolean }) {
    const cols = showRemarks
      ? ['Customer / Enrollment', 'Mobile', 'Monthly', 'Overdue', 'Pending', 'Last Follow-up', 'Actions']
      : ['Customer / Enrollment', 'Mobile', 'Monthly', 'Pending', 'Actions']
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cols.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={cols.length} style={{ padding: 32, textAlign: 'center', color: MUTED }}>None</td></tr>
              : items.map((item: any) => <DueRow key={item.enrollment.id} item={item} showRemarks={showRemarks} />)}
          </tbody>
        </table>
      </div>
    )
  }

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  return (
    <div style={{ padding: '36px 40px' }}>
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT, marginBottom: 6 }}>Daily Due List</h1>
      <p style={{ color: MUTED, fontSize: 13.5, marginBottom: 28 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Due Today',       value: dueToday.length, sub: INR(dueToday.reduce((s:number,d:any)=>s+d.enrollment.monthly_amount,0)), color: '#856404' },
          { label: 'Overdue Accounts', value: overdue.length,  sub: INR(overdue.reduce((s:number,d:any)=>s+d.pendingAmount,0)),             color: '#C03030' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '22px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 30, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 12 }}>Due Today ({dueToday.length})</div>
        <Table items={dueToday} showRemarks={false} />
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 12 }}>Overdue ({overdue.length})</div>
        <Table items={overdue} showRemarks={true} />
      </div>

      {/* ── Payment Modal ── */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Record Payment</h2>
              <button onClick={() => setPayModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 13 }}>
              <strong>{payModal.customer?.full_name}</strong> · {payModal.enrollment?.enrollment_id}<br />
              <span style={{ color: MUTED }}>Pending: </span><span style={{ color: '#C03030', fontWeight: 600 }}>{INR(payModal.pendingAmount)}</span>
            </div>
            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Lbl t="Months" /><input type="number" min="1" required value={payForm.months} onChange={e => setPayForm({...payForm, months: e.target.value})} style={inp} /></div>
                <div><Lbl t="Date" /><input type="date" required value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} style={inp} /></div>
              </div>
              <div>
                <Lbl t="Payment Mode" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[['cash','Cash'],['upi','UPI'],['cheque','Cheque'],['bank_transfer','Bank']].map(([v,l]) => (
                    <button type="button" key={v} onClick={() => setPayForm({...payForm, mode: v})}
                      style={{ padding: '8px 4px', borderRadius: 8, border: payForm.mode===v ? `1.5px solid ${GOLD}` : BORDER, background: payForm.mode===v ? '#FBF8F0' : '#fff', color: payForm.mode===v ? GOLD : MUTED, fontWeight: payForm.mode===v ? 700 : 400, cursor: 'pointer', fontSize: 12.5 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {payForm.mode !== 'cash' && (
                <div><Lbl t={payForm.mode === 'cheque' ? 'Cheque No.' : 'Transaction ID'} />
                  <input type="text" value={payForm.txnId} onChange={e => setPayForm({...payForm, txnId: e.target.value})} style={inp} />
                </div>
              )}
              <div style={{ padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 14, fontWeight: 700, color: GOLD }}>
                Total: {INR(payModal.enrollment.monthly_amount * parseInt(payForm.months || '1'))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={savingPay}
                  style={{ flex: 1, background: savingPay ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {savingPay ? 'Saving...' : 'Record Payment'}
                </button>
                <button type="button" onClick={() => setPayModal(null)} style={{ padding: '11px 20px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remark / Follow-up Modal ── */}
      {remarkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: BORDER }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT, marginBottom: 3 }}>Follow-up Notes</h2>
                <div style={{ fontSize: 13, color: MUTED }}>
                  <strong style={{ color: TEXT }}>{remarkModal.customer?.full_name}</strong>
                  {' · '}{remarkModal.customer?.mobile}
                  {' · '}<span style={{ color: '#C03030', fontWeight: 600 }}>{remarkModal.overdueMonths} month{remarkModal.overdueMonths > 1 ? 's' : ''} overdue</span>
                </div>
              </div>
              <button onClick={() => setRemarkModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED, marginTop: -4 }}>×</button>
            </div>

            {/* History */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {(followUps[remarkModal.enrollment.id] ?? []).length === 0 ? (
                <div style={{ fontSize: 13.5, color: MUTED, fontStyle: 'italic', marginBottom: 16 }}>No follow-up notes yet. Add the first one below.</div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>History ({(followUps[remarkModal.enrollment.id] ?? []).length} notes)</div>
                  {(followUps[remarkModal.enrollment.id] ?? []).map((fu: any, i: number) => (
                    <div key={fu.id} style={{ marginBottom: 10, padding: '12px 14px', background: i === 0 ? '#FBF8F0' : '#F9F9F9', borderRadius: 8, border: BORDER, borderLeft: `3px solid ${i === 0 ? GOLD : '#E5DDD0'}` }}>
                      <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.5, marginBottom: 6 }}>{fu.remark}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ fontSize: 11.5, color: MUTED }}>
                          <span style={{ fontWeight: 600, color: TEXT }}>{fu.followed_by}</span>
                          {' · '}{FD(fu.remark_date)}
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: 10, background: GOLD, color: '#fff', borderRadius: 4, padding: '1px 5px' }}>Latest</span>}
                        </div>
                        {fu.next_followup_date && (
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: new Date(fu.next_followup_date+'T00:00:00') <= new Date() ? '#C03030' : '#1A5FB4' }}>
                            📅 Follow up by {FD(fu.next_followup_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new remark */}
              <div style={{ borderTop: BORDER, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Add Follow-up Note
                </div>
                <form onSubmit={handleAddRemark} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <Lbl t="Remark / Comment" />
                    <textarea required value={remarkText} onChange={e => setRemarkText(e.target.value)}
                      placeholder="e.g. Customer spoke to us, will pay by Friday. Says he's out of town."
                      rows={3}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Lbl t="Followed Up By" />
                      <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
                        style={{ ...inp, background: '#F9F9F9' }} />
                    </div>
                    <div>
                      <Lbl t="Next Follow-up Date (optional)" />
                      <input type="date" value={nextFollowup} onChange={e => setNextFollowup(e.target.value)} style={inp}
                        min={todayLocal()} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={savingRemark || !remarkText.trim()}
                      style={{ flex: 1, background: !remarkText.trim() || savingRemark ? `${GOLD}88` : GOLD, color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: remarkText.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14 }}>
                      {savingRemark ? 'Saving...' : '+ Save Note'}
                    </button>
                    <button type="button" onClick={() => setRemarkModal(null)}
                      style={{ padding: '10px 18px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Close</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
