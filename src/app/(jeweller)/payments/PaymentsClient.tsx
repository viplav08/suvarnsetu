'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatINR, formatDate } from '@/lib/utils'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const MODE_LABEL: Record<string,string> = { cash:'Cash', upi:'UPI', cheque:'Cheque', bank_transfer:'Bank Transfer' }

export default function PaymentsClient({ payments, enrollments, tenantId }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ enrollment_id: '', months_paid_for: '1', payment_date: new Date().toISOString().split('T')[0], mode: 'cash', txnId: '', remarks: '' })

  const selected = enrollments.find((e: any) => e.id === form.enrollment_id)
  const total = selected ? selected.monthly_amount * parseInt(form.months_paid_for || '1') : 0

  function resetForm() { setForm({ enrollment_id: '', months_paid_for: '1', payment_date: new Date().toISOString().split('T')[0], mode: 'cash', txnId: '', remarks: '' }) }

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return; setSaving(true)
    const { data: idData } = await supabase.rpc('next_payment_id', { p_tenant_id: tenantId })
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId, payment_id: idData,
      enrollment_id: form.enrollment_id, customer_id: selected.customer_id,
      payment_date: form.payment_date, months_paid_for: parseInt(form.months_paid_for),
      amount_received: total, payment_mode: form.mode,
      transaction_id: form.txnId || null, remarks: form.remarks || null,
    })
    setSaving(false)
    if (!error) { setShowModal(false); resetForm(); router.refresh() }
    else alert('Error: ' + error.message)
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Payments</h1>
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{payments.length} entries · multi-month supported</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>+ Record Payment</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Payment ID','Customer','Enrollment','Date','Months','Mode','Amount','Remarks'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {payments.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No payments yet.</td></tr>
              : payments.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{p.payment_id}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <div style={{ fontWeight: 600, color: TEXT }}>{p.enrollments?.customers?.full_name ?? p.customers?.full_name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{p.enrollments?.customers?.customer_id ?? p.customers?.customer_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{p.enrollments?.enrollment_id ?? '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(p.payment_date)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{p.months_paid_for}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, background: p.payment_mode === 'upi' ? '#EEF6FF' : p.payment_mode === 'cheque' ? '#FFF8E0' : p.payment_mode === 'bank_transfer' ? '#F0FFF4' : '#F5F5F5', color: p.payment_mode === 'upi' ? '#1A5FB4' : p.payment_mode === 'cheque' ? '#856404' : p.payment_mode === 'bank_transfer' ? '#1A7A3A' : '#555' }}>
                      {MODE_LABEL[p.payment_mode ?? 'cash'] ?? 'Cash'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: TEXT, fontSize: 13.5 }}>{formatINR(p.amount_received)}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 13 }}>{p.remarks || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Record Payment</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleRecord} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Enrollment</label>
                <select required value={form.enrollment_id} onChange={e => setForm({ ...form, enrollment_id: e.target.value })}
                  style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff' }}>
                  <option value="">— Select active enrollment —</option>
                  {enrollments.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.customers?.full_name} — {e.enrollment_id} ({formatINR(e.monthly_amount)}/mo)</option>
                  ))}
                </select>
              </div>
              {selected && <div style={{ padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 13 }}><strong>{selected.customers?.full_name}</strong> · {selected.enrollment_id} · {formatINR(selected.monthly_amount)}/month</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Months Paying</label>
                  <input type="number" min="1" required value={form.months_paid_for} onChange={e => setForm({ ...form, months_paid_for: e.target.value })}
                    style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payment Date</label>
                  <input type="date" required value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })}
                    style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[['cash','Cash'],['upi','UPI'],['cheque','Cheque'],['bank_transfer','Bank']].map(([val,lbl]) => (
                    <button type="button" key={val} onClick={() => setForm({ ...form, mode: val })}
                      style={{ padding: '9px 4px', borderRadius: 8, border: form.mode === val ? `1.5px solid ${GOLD}` : BORDER, background: form.mode === val ? '#FBF8F0' : '#fff', color: form.mode === val ? GOLD : MUTED, fontWeight: form.mode === val ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {form.mode !== 'cash' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{form.mode === 'cheque' ? 'Cheque No.' : 'Transaction ID'} (optional)</label>
                  <input type="text" value={form.txnId} onChange={e => setForm({ ...form, txnId: e.target.value })}
                    style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {selected && <div style={{ padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, fontSize: 14, fontWeight: 700, color: GOLD }}>Total: {formatINR(total)}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving || !selected}
                  style={{ flex: 1, background: !selected || saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '11px', borderRadius: 8, cursor: !selected ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); resetForm() }}
                  style={{ padding: '11px 20px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
