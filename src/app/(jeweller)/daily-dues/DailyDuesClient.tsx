'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INR     = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const GOLD    = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const FD      = (d: string) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateStr = (d: any) => !d ? '' : String(d).substring(0, 10)
const todayLocal = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') }

export default function DailyDuesClient({ dueToday, overdue, renewingSoon, tenantId }: any) {
  const router   = useRouter()
  const supabase = createClient()

  // ── Shop info for receipts ────────────────────────────────────────
  const [shopName,   setShopName]   = useState('')
  const [shopMobile, setShopMobile] = useState('')
  const [userName,   setUserName]   = useState('')

  useEffect(() => {
    async function loadInfo() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const tid  = user.app_metadata?.tenant_id
      const role = user.app_metadata?.role
      const { data: t } = await supabase.from('tenants').select('shop_name, mobile, owner_name').eq('id', tid).single()
      setShopName(t?.shop_name ?? ''); setShopMobile(t?.mobile ?? '')
      if (role === 'manager') {
        const { data: s } = await supabase.from('staff').select('name').eq('auth_user_id', user.id).maybeSingle()
        setUserName(s?.name ?? t?.owner_name ?? 'Admin')
      } else { setUserName(t?.owner_name ?? 'Admin') }
    }
    loadInfo()
  }, [])

  // ── Follow-ups ────────────────────────────────────────────────────
  const [followUps, setFollowUps] = useState<Record<string, any[]>>({})
  useEffect(() => { loadFollowUps() }, [])

  async function loadFollowUps() {
    const { data } = await supabase.from('follow_ups').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    const grouped: Record<string, any[]> = {}
    for (const fu of (data ?? [])) {
      if (!grouped[fu.enrollment_id]) grouped[fu.enrollment_id] = []
      grouped[fu.enrollment_id].push(fu)
    }
    setFollowUps(grouped)
  }

  // ── Payment modal ─────────────────────────────────────────────────
  const [payModal,   setPayModal]   = useState<any>(null)
  const [payForm,    setPayForm]    = useState({ months: '1', date: todayLocal(), mode: 'cash', txnId: '', remarks: '' })
  const [savingPay,  setSavingPay]  = useState(false)
  const [paySuccess, setPaySuccess] = useState<any>(null)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault(); setSavingPay(true)
    const { data: idData } = await supabase.rpc('next_payment_id', { p_tenant_id: tenantId })
    const months  = parseInt(payForm.months)
    const amount  = payModal.enrollment.monthly_amount * months
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId, payment_id: idData,
      enrollment_id: payModal.enrollment.id, customer_id: payModal.enrollment.customer_id,
      payment_date: payForm.date, months_paid_for: months, amount_received: amount,
      payment_mode: payForm.mode, transaction_id: payForm.txnId || null, remarks: payForm.remarks || null,
    })
    setSavingPay(false)
    if (!error) {
      setPaySuccess({ amount, customer: payModal.customer, enrollment: payModal.enrollment, date: payForm.date, months })
      setPayModal(null)
      setPayForm({ months: '1', date: todayLocal(), mode: 'cash', txnId: '', remarks: '' })
    } else alert(error.message)
  }

  function sendWhatsAppReceipt(data: any) {
    const phone   = data.customer.whatsapp || data.customer.mobile
    const cleaned = phone.replace(/\D/g, '')
    const number  = cleaned.startsWith('91') ? cleaned : '91' + cleaned
    const dateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const msg = `✅ *Payment Received*\n\nCustomer: ${data.customer.full_name}\nAmount: ${INR(data.amount)}\nDate: ${dateStr}\n${data.months > 1 ? `Months: ${data.months}\n` : ''}Enrollment: ${data.enrollment.enrollment_id}\n\nThank you! 🙏\n— ${shopName}${shopMobile ? '\n📞 ' + shopMobile : ''}`
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank')
    setPaySuccess(null)
    router.refresh()
  }

  // ── Remark modal ──────────────────────────────────────────────────
  const [remarkModal,  setRemarkModal]  = useState<any>(null)
  const [remarkText,   setRemarkText]   = useState('')
  const [nextFollowup, setNextFollowup] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)

  function openRemarkModal(item: any) { setRemarkModal(item); setRemarkText(''); setNextFollowup('') }

  async function handleAddRemark(e: React.FormEvent) {
    e.preventDefault(); if (!remarkText.trim()) return; setSavingRemark(true)
    await supabase.from('follow_ups').insert({ enrollment_id: remarkModal.enrollment.id, tenant_id: tenantId, remark: remarkText.trim(), followed_by: userName, next_followup_date: nextFollowup || null, remark_date: todayLocal() })
    setSavingRemark(false); setRemarkText(''); setNextFollowup(''); await loadFollowUps()
  }

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  // ── Mobile card component (shown on small screens) ──────────────
  function DueMobileCard({ item, showRemarks }: any) {
    const eid    = item.enrollment.id
    const fus    = followUps[eid] ?? []
    const latest = fus[0]
    const phone  = item.customer?.whatsapp || item.customer?.mobile
    const isOverdue = showRemarks
    return (
      <div style={{ background: '#fff', border: isOverdue ? '1px solid #FECACA' : '1px solid #E5DDD0', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{item.customer?.full_name}</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{item.customer?.mobile} · {item.enrollment?.enrollment_id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: isOverdue ? '#C03030' : GOLD }}>{INR(item.pendingAmount)}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{INR(item.enrollment?.monthly_amount)}/mo</div>
          </div>
        </div>
        {isOverdue && (
          <div style={{ fontSize: 12, color: '#C03030', fontWeight: 600, marginBottom: 8 }}>
            ⚠ {item.overdueMonths} month{item.overdueMonths > 1 ? 's' : ''} overdue · {item.daysOverdue} days
          </div>
        )}
        {latest && (
          <div style={{ fontSize: 12, color: MUTED, background: '#F9F7F3', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
            📝 {latest.remark} · <span style={{ color: '#1A5FB4' }}>{FD(latest.remark_date)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPayModal(item)}
            style={{ flex: 1, background: GOLD, color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            ₹ Pay
          </button>
          {showRemarks && (
            <button onClick={() => openRemarkModal(item)}
              style={{ flex: 1, background: fus.length > 0 ? '#1B1108' : 'transparent', color: fus.length > 0 ? '#fff' : MUTED, border: BORDER, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              📝 {fus.length > 0 ? `Notes (${fus.length})` : 'Add Note'}
            </button>
          )}
          {item.enrollment?.passbook_token && (
            <a href={`/passbook/${item.enrollment.passbook_token}`} target="_blank" rel="noopener noreferrer"
              style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '10px 14px', borderRadius: 8, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              📖
            </a>
          )}
        </div>
      </div>
    )
  }

  function DueRow({ item, showRemarks }: any) {
    const eid    = item.enrollment.id
    const fus    = followUps[eid] ?? []
    const latest = fus[0]
    const overdueNextFU = latest?.next_followup_date && new Date(latest.next_followup_date + 'T00:00:00') <= new Date()
    const phone  = item.customer?.whatsapp || item.customer?.mobile

    return (
      <tr>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ fontWeight: 600, color: TEXT }}>{item.customer?.full_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{item.customer?.customer_id} · {item.enrollment?.enrollment_id}</div>
        </td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13 }}>{item.customer?.mobile}</td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: GOLD }}>{INR(item.enrollment?.monthly_amount)}</td>
        {showRemarks && (
          <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#C03030' }}>{item.overdueMonths}mo · {item.daysOverdue}d</div>
          </td>
        )}
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: showRemarks ? '#C03030' : '#856404', fontSize: 13.5 }}>
          {INR(item.pendingAmount)}
        </td>
        {showRemarks && (
          <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', maxWidth: 180 }}>
            {latest ? (
              <div>
                <div style={{ fontSize: 11.5, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 160 }}>{latest.remark}</div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{FD(latest.remark_date)} · {latest.followed_by}{fus.length > 1 && <span style={{ marginLeft: 5, background: '#F5F0E6', color: MUTED, borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>+{fus.length-1}</span>}</div>
                {latest.next_followup_date && <div style={{ fontSize: 10.5, marginTop: 2, color: overdueNextFU ? '#C03030' : '#1A5FB4', fontWeight: 600 }}>📅 {FD(latest.next_followup_date)}</div>}
              </div>
            ) : <span style={{ fontSize: 11.5, color: MUTED, fontStyle: 'italic' }}>No notes</span>}
          </td>
        )}
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setPayModal(item)}
              style={{ background: GOLD, color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>₹ Pay</button>
            {showRemarks && (
              <button onClick={() => openRemarkModal(item)}
                style={{ background: fus.length > 0 ? '#1B1108' : 'transparent', color: fus.length > 0 ? '#fff' : MUTED, border: BORDER, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                📝 {fus.length > 0 ? `${fus.length}` : 'Note'}
              </button>
            )}
            {item.enrollment?.passbook_token && (
              <a href={`/passbook/${item.enrollment.passbook_token}`} target="_blank" rel="noopener noreferrer"
                style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, textDecoration: 'none' }}>
                📖
              </a>
            )}
          </div>
        </td>
      </tr>
    )
  }

  function Table({ items, showRemarks }: any) {
    const cols = showRemarks
      ? ['Customer', 'Mobile', 'Monthly', 'Overdue', 'Pending', 'Last Note', 'Actions']
      : ['Customer', 'Mobile', 'Monthly', 'Pending', 'Actions']
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{cols.map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
          <tbody>
            {items.length === 0
              ? <tr><td colSpan={cols.length} style={{ padding: 32, textAlign: 'center', color: MUTED }}>None</td></tr>
              : items.map((item: any) => <DueRow key={item.enrollment.id} item={item} showRemarks={showRemarks} />)}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT, marginBottom: 6 }}>Daily Due List</h1>
      <p style={{ color: MUTED, fontSize: 13.5, marginBottom: 24 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Due Today',        value: dueToday.length,   sub: INR(dueToday.reduce((s:number,d:any)=>s+d.enrollment.monthly_amount,0)),   color: '#856404' },
          { label: 'Overdue',          value: overdue.length,    sub: INR(overdue.reduce((s:number,d:any)=>s+d.pendingAmount,0)),                 color: '#C03030' },
          { label: 'Renewing in 45d',  value: renewingSoon?.length ?? 0, sub: 'schemes completing soon', color: '#1A5FB4' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '20px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Due Today */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 10 }}>Due Today ({dueToday.length})</div>
        <Table items={dueToday} showRemarks={false} />
      </div>

      {/* Overdue */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 10 }}>Overdue ({overdue.length})</div>
        <Table items={overdue} showRemarks={true} />
      </div>

      {/* Renewing Soon */}
      {renewingSoon?.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 6 }}>Renewing Soon ({renewingSoon.length})</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>These schemes complete within 45 days. Contact customers about redemption or renewal.</div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Customer', 'Mobile', 'Enrollment', 'Monthly', 'Completes On', 'Months Left', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {renewingSoon.map((item: any) => {
                  const phone = item.customer?.whatsapp || item.customer?.mobile
                  const cleaned = (phone || '').replace(/\D/g, '')
                  const number  = cleaned.startsWith('91') ? cleaned : '91' + cleaned
                  const msg = `Dear ${item.customer?.full_name}, your gold saving scheme (${item.enrollment?.enrollment_id}) is completing on ${FD(item.completesOn)}. Please visit us for redemption or to start a new scheme. — ${shopName}`
                  return (
                    <tr key={item.enrollment.id} style={{ background: item.daysLeft <= 15 ? '#FBF8F0' : '#fff' }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        <div style={{ fontWeight: 600, color: TEXT }}>{item.customer?.full_name}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13 }}>{item.customer?.mobile}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13 }}>{item.enrollment?.enrollment_id}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: GOLD }}>{INR(item.enrollment?.monthly_amount)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: item.daysLeft <= 15 ? '#C05000' : TEXT, fontWeight: 600 }}>{FD(item.completesOn)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: item.daysLeft <= 15 ? '#FEF0E0' : '#EEF6FF', color: item.daysLeft <= 15 ? '#C05000' : '#1A5FB4' }}>{item.daysLeft} days</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        {phone && (
                          <a href={`https://wa.me/${number}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
                            style={{ background: '#25D366', color: '#fff', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            📱 Notify
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                      style={{ padding: '8px 4px', borderRadius: 8, border: payForm.mode===v ? `1.5px solid ${GOLD}` : BORDER, background: payForm.mode===v ? '#FBF8F0' : '#fff', color: payForm.mode===v ? GOLD : MUTED, fontWeight: payForm.mode===v ? 700 : 400, cursor: 'pointer', fontSize: 12.5 }}>{l}</button>
                  ))}
                </div>
              </div>
              {payForm.mode !== 'cash' && (
                <div><Lbl t={payForm.mode==='cheque' ? 'Cheque No.' : 'Transaction ID'} />
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

      {/* ── Payment Success + Receipt ── */}
      {paySuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 26, fontWeight: 400, color: TEXT, marginBottom: 6 }}>Payment Recorded!</h2>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1A7A3A', marginBottom: 4 }}>{INR(paySuccess.amount)}</div>
            <div style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>
              {paySuccess.customer.full_name} · {paySuccess.enrollment.enrollment_id}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(paySuccess.customer.whatsapp || paySuccess.customer.mobile) && (
                <button onClick={() => sendWhatsAppReceipt(paySuccess)}
                  style={{ background: '#25D366', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  📱 Send Receipt on WhatsApp
                </button>
              )}
              <button onClick={() => { setPaySuccess(null); router.refresh() }}
                style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '11px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Skip, Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remark Modal ── */}
      {remarkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: BORDER }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT, marginBottom: 3 }}>Follow-up Notes</h2>
                <div style={{ fontSize: 13, color: MUTED }}><strong style={{ color: TEXT }}>{remarkModal.customer?.full_name}</strong> · {remarkModal.customer?.mobile} · <span style={{ color: '#C03030', fontWeight: 600 }}>{remarkModal.overdueMonths} month{remarkModal.overdueMonths > 1 ? 's' : ''} overdue</span></div>
              </div>
              <button onClick={() => setRemarkModal(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {(followUps[remarkModal.enrollment.id] ?? []).length === 0
                ? <div style={{ fontSize: 13.5, color: MUTED, fontStyle: 'italic', marginBottom: 16 }}>No notes yet.</div>
                : (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>History ({(followUps[remarkModal.enrollment.id] ?? []).length})</div>
                    {(followUps[remarkModal.enrollment.id] ?? []).map((fu: any, i: number) => (
                      <div key={fu.id} style={{ marginBottom: 10, padding: '12px 14px', background: i === 0 ? '#FBF8F0' : '#F9F9F9', borderRadius: 8, border: BORDER, borderLeft: `3px solid ${i === 0 ? GOLD : '#E5DDD0'}` }}>
                        <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.5, marginBottom: 6 }}>{fu.remark}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUTED }}>
                          <span><strong style={{ color: TEXT }}>{fu.followed_by}</strong> · {FD(fu.remark_date)}{i === 0 && <span style={{ marginLeft: 6, fontSize: 10, background: GOLD, color: '#fff', borderRadius: 4, padding: '1px 5px' }}>Latest</span>}</span>
                          {fu.next_followup_date && <span style={{ color: '#1A5FB4', fontWeight: 600 }}>📅 {FD(fu.next_followup_date)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              <div style={{ borderTop: BORDER, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Add Note</div>
                <form onSubmit={handleAddRemark} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div><Lbl t="Remark" /><textarea required value={remarkText} onChange={e => setRemarkText(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} placeholder="e.g. Called customer, will pay by Friday" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><Lbl t="Followed By" /><input type="text" value={userName} onChange={e => setUserName(e.target.value)} style={{ ...inp, background: '#F9F9F9' }} /></div>
                    <div><Lbl t="Next Follow-up" /><input type="date" value={nextFollowup} onChange={e => setNextFollowup(e.target.value)} style={inp} min={todayLocal()} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={savingRemark || !remarkText.trim()}
                      style={{ flex: 1, background: !remarkText.trim() || savingRemark ? `${GOLD}88` : GOLD, color: '#fff', border: 'none', padding: 10, borderRadius: 8, cursor: remarkText.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14 }}>
                      {savingRemark ? 'Saving...' : '+ Save Note'}
                    </button>
                    <button type="button" onClick={() => setRemarkModal(null)} style={{ padding: '10px 18px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Close</button>
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
