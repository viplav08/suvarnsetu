'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INR = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '#E5DDD0'

export default function DailyDuesClient({ dueToday, overdue, allCustomers, tenantId }: any) {
  const router = useRouter()
  const supabase = createClient()
  const [payModal, setPayModal] = useState<any>(null)
  const [form, setForm] = useState({ months: '1', date: new Date().toISOString().split('T')[0], mode: 'cash', txnId: '', remarks: '' })
  const [saving, setSaving] = useState(false)

  const total = form.months && payModal ? payModal.customer.monthly_amount * parseInt(form.months) : 0

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: idData } = await supabase.rpc('next_payment_id', { p_tenant_id: tenantId })
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId,
      payment_id: idData,
      customer_id: payModal.customer.id,
      payment_date: form.date,
      months_paid_for: parseInt(form.months),
      amount_received: total,
      payment_mode: form.mode,
      transaction_id: form.txnId || null,
      remarks: form.remarks || null,
    })
    setSaving(false)
    if (!error) { setPayModal(null); router.refresh() }
    else alert(error.message)
  }

  const DueRow = ({ item, highlight }: any) => (
    <tr>
      <td style={{ padding: '12px 14px', borderBottom: `1px solid #F0EAE0` }}>
        <div style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>{item.customer.full_name}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{item.customer.mobile}</div>
      </td>
      <td style={{ padding: '12px 14px', borderBottom: `1px solid #F0EAE0`, color: TEXT }}>{INR(item.customer.monthly_amount)}</td>
      <td style={{ padding: '12px 14px', borderBottom: `1px solid #F0EAE0` }}>
        {item.overdueMonths > 0 && <span style={{ color: '#C03030', fontWeight: 600 }}>{item.overdueMonths} month(s)</span>}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: `1px solid #F0EAE0`, fontWeight: 700, color: highlight ? '#856404' : '#C03030' }}>
        {INR(item.pendingAmount)}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: `1px solid #F0EAE0` }}>
        <button onClick={() => setPayModal(item)}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          + Record
        </button>
      </td>
    </tr>
  )

  const Table = ({ items, highlight }: any) => (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Customer', 'Monthly', 'Overdue', 'Pending', 'Action'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {items.length === 0
            ? <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: MUTED, fontSize: 13.5 }}>None</td></tr>
            : items.map((item: any) => <DueRow key={item.customer.id} item={item} highlight={highlight} />)
          }
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ padding: '36px 40px' }}>
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT, marginBottom: 6 }}>Daily Due List</h1>
      <p style={{ color: MUTED, fontSize: 13.5, marginBottom: 28 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Due Today', value: dueToday.length, sub: INR(dueToday.reduce((s: number, d: any) => s + d.customer.monthly_amount, 0)), color: '#856404' },
          { label: 'Overdue Accounts', value: overdue.length, sub: INR(overdue.reduce((s: number, d: any) => s + d.pendingAmount, 0)), color: '#C03030' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '22px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 30, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
          Due Today ({dueToday.length})
        </div>
        <Table items={dueToday} highlight />
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
          Overdue ({overdue.length})
        </div>
        <Table items={overdue} highlight={false} />
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Record Payment</h2>
              <button onClick={() => setPayModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13 }}>
              <strong>{payModal.customer.full_name}</strong> · {INR(payModal.customer.monthly_amount)}/month · Pending: {INR(payModal.pendingAmount)}
            </div>
            <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Months Paying</label>
                  <input type="number" min="1" required value={form.months} onChange={e => setForm({ ...form, months: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</label>
                  <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[['cash', 'Cash'], ['upi', 'UPI'], ['cheque', 'Cheque'], ['bank_transfer', 'Bank']].map(([val, lbl]) => (
                    <button type="button" key={val} onClick={() => setForm({ ...form, mode: val })}
                      style={{ padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${form.mode === val ? GOLD : BORDER}`, background: form.mode === val ? '#FBF8F0' : '#fff', color: form.mode === val ? GOLD : MUTED, fontWeight: form.mode === val ? 700 : 400, cursor: 'pointer', fontSize: 12.5 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {(form.mode === 'upi' || form.mode === 'cheque' || form.mode === 'bank_transfer') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {form.mode === 'cheque' ? 'Cheque No.' : 'Transaction ID'} (optional)
                  </label>
                  <input type="text" value={form.txnId} onChange={e => setForm({ ...form, txnId: e.target.value })}
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Remarks (optional)</label>
                <input type="text" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                  style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 600, color: GOLD }}>
                Total Amount: {INR(total)}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 10, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
                <button type="button" onClick={() => setPayModal(null)}
                  style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}