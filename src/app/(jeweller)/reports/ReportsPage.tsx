'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD   = (d: any): string => {
  if (!d) return '—'
  const s  = String(d)
  const dt = d instanceof Date ? d : new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
// Timezone-safe date string — always uses local date components
const dateStr = (d: any) => {
  if (!d) return ''
  const s = String(d)
  if (s.length >= 10) return s.substring(0, 10)
  return ''
}

const MODE_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', cheque: 'Cheque', bank_transfer: 'Bank Transfer',
}

// ── Key fix: strict enrollment matching ──────────────────────────────────
// Payments with enrollment_id → match by UUID only
// Legacy payments (no enrollment_id) → match by customer_id only for original enrollment
function getPaidMonths(enrollment: any, payments: any[]): number {
  return payments
    .filter((p: any) => {
      if (p.enrollment_id) {
        return p.enrollment_id === enrollment.id
      }
      return p.customer_id === enrollment.customer_id &&
             !enrollment.enrollment_id?.startsWith('ENR-')
    })
    .reduce((s: number, p: any) => s + (p.months_paid_for || 1), 0)
}

function countDueDates(signupDate: string, upTo: Date): number {
  const signup = new Date(signupDate + 'T00:00:00')
  const day    = signup.getDate()
  let n = 0, cur = new Date(signup)
  while (cur <= upTo) { n++; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, day) }
  return n
}

function dlCSV(rows: any[][], fn: string) {
  const csv  = rows.map(r => r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = fn; a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage({ plan = 'trial' }: { plan?: string }) {
  const supabase = createClient()
  const router   = useRouter()
  const [tab,         setTab]         = useState('Daily Due')
  const [loading,     setLoading]     = useState(true)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments,    setPayments]    = useState<any[]>([])
  const [closures,    setClosures]    = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id

    const [en, p, cl] = await Promise.all([
      // Active enrollments with customer details
      supabase
        .from('enrollments')
        .select('*, customers(full_name, customer_id, mobile, birth_date, anniversary_date)')
        .eq('tenant_id', tid)
        .eq('status', 'active'),
      // All payments
      supabase
        .from('payments')
        .select('*, enrollments(enrollment_id, monthly_amount, customers(full_name, customer_id, mobile))')
        .eq('tenant_id', tid)
        .order('payment_date', { ascending: false }),
      // Closed accounts
      supabase
        .from('account_closures')
        .select('*, enrollments(enrollment_id, monthly_amount, signup_date, customers(full_name, customer_id, mobile))')
        .eq('tenant_id', tid)
        .order('closure_date', { ascending: false }),
    ])

    setEnrollments(en.data ?? [])
    setPayments(p.data ?? [])
    setClosures(cl.data ?? [])
    setLoading(false)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── Due / Overdue (per enrollment, not per customer) ─────────────────
  const dueInfo = enrollments.map(e => {
    const signup = new Date(e.signup_date + 'T00:00:00')
    const dueDay = signup.getDate()
    const dates: Date[] = []; let cur = new Date(signup)
    while (cur <= today) { dates.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, dueDay) }
    const paid        = getPaidMonths(e, payments)
    const pending     = Math.max(0, dates.length - paid)
    const overdueN    = Math.max(0, dates.filter(d => d < today).length - paid)
    const firstUnpaid = overdueN > 0 ? new Date(signup.getFullYear(), signup.getMonth() + paid, signup.getDate()) : null
    const daysOD      = firstUnpaid ? Math.floor((today.getTime() - firstUnpaid.getTime()) / 86400000) : 0
    return {
      enrollment: e,
      customer:   e.customers,
      dueDay, pending,
      pendingAmount:  pending * e.monthly_amount,
      isDueToday:     dueDay === today.getDate() && pending > 0,
      isOverdue:      overdueN > 0,
      overdueMonths:  overdueN,
      firstUnpaid,
      daysOD,
    }
  })

  const dueToday = dueInfo.filter(d => d.isDueToday)
  const overdue  = dueInfo.filter(d => d.isOverdue).sort((a, b) => b.daysOD - a.daysOD)

  // ── Monthly Forecast ──────────────────────────────────────────────────
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const monthName  = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const monthlyStatus = enrollments.map(e => {
    const signup     = new Date(e.signup_date + 'T00:00:00')
    const dueDay     = signup.getDate()
    const dueThisMo  = new Date(today.getFullYear(), today.getMonth(), dueDay)
    const dueByEnd   = countDueDates(e.signup_date, today)   // count to TODAY, not month end
    const paidTotal  = getPaidMonths(e, payments)          // ← correct matching
    const pendingMo  = Math.max(0, dueByEnd - paidTotal)
    const pendingAmt = pendingMo * e.monthly_amount
    const status     = pendingMo <= 0 ? 'paid' : dueThisMo > today ? 'upcoming' : 'overdue_month'
    return { enrollment: e, customer: e.customers, dueDay, dueThisMo, pendingMo, pendingAmt, status }
  }).sort((a, b) => {
    if (a.status === 'overdue_month' && b.status !== 'overdue_month') return -1
    if (b.status === 'overdue_month' && a.status !== 'overdue_month') return 1
    if (a.status === 'upcoming' && b.status === 'upcoming') return a.dueDay - b.dueDay
    if (a.status === 'paid' && b.status !== 'paid') return 1
    return 0
  })

  const totalOutstanding   = monthlyStatus.reduce((s, m) => s + m.pendingAmt, 0)
  // Timezone-safe: build todayStr from local components (not toISOString which is UTC)
  const todayStr = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-')
  const monthStartStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
  const totalMRR = enrollments.filter(e => e.status === 'active').reduce((s, e) => s + e.monthly_amount, 0)
  const collectedThisMonth = payments
    .filter(p => { const d = dateStr(p.payment_date); return d >= monthStartStr && d <= todayStr })
    .reduce((s, p) => s + p.amount_received, 0)
  const paidCount = monthlyStatus.filter(m => m.status === 'paid').length
  const stillToCollect = Math.max(0, totalMRR - collectedThisMonth)
  const duePct = totalMRR > 0 ? Math.min(100, Math.round((collectedThisMonth / totalMRR) * 100)) : 100

  // ── Payment coverage (what months did each payment cover) ─────────────
  const paymentCoverage = useMemo(() => {
    const byEnrollment: Record<string, any[]> = {}
    for (const p of payments) {
      const eid = p.enrollment_id || ('legacy_' + p.customer_id)
      if (!byEnrollment[eid]) byEnrollment[eid] = []
      byEnrollment[eid].push(p)
    }
    Object.values(byEnrollment).forEach(arr =>
      arr.sort((a, b) => new Date(a.payment_date + 'T00:00:00').getTime() - new Date(b.payment_date + 'T00:00:00').getTime())
    )
    const map: Record<string, { label: string; color: string; bg: string }> = {}
    for (const arr of Object.values(byEnrollment)) {
      const signupDate = arr[0]?.enrollments?.signup_date || arr[0]?.customers?.signup_date
      if (!signupDate) continue
      const signup = new Date(signupDate + 'T00:00:00')
      let prevPaid = 0
      for (const p of arr) {
        const payKey   = new Date(p.payment_date + 'T00:00:00')
        const payMoKey = payKey.getFullYear() * 12 + payKey.getMonth()
        const count    = p.months_paid_for || 1
        let overdue = 0, current = 0, advance = 0
        for (let i = 0; i < count; i++) {
          const covDate = new Date(signup.getFullYear(), signup.getMonth() + prevPaid + i, signup.getDate())
          const covKey  = covDate.getFullYear() * 12 + covDate.getMonth()
          if      (covKey < payMoKey) overdue++
          else if (covKey === payMoKey) current++
          else advance++
        }
        const parts: string[] = []
        if (overdue  > 0) parts.push(overdue  > 1 ? `${overdue}× Overdue`  : 'Overdue')
        if (current  > 0) parts.push('Current Month')
        if (advance  > 0) parts.push(advance  > 1 ? `${advance}× Advance`  : 'Advance')
        const label = parts.join(' + ')
        const color = (overdue > 0 && current === 0 && advance === 0) ? '#C03030'
                    : (advance > 0 && current === 0 && overdue === 0) ? '#1A5FB4'
                    : '#1A7A3A'
        const bg    = (overdue > 0 && current === 0 && advance === 0) ? '#FEE2E2'
                    : (advance > 0 && current === 0 && overdue === 0) ? '#EEF6FF'
                    : '#F0FFF4'
        map[p.id] = { label, color, bg }
        prevPaid += count
      }
    }
    return map
  }, [payments])

  const TABS = ['Daily Due', 'Overdue', 'Monthly Forecast', 'Payments', 'Closed']
  const Th   = ({ h }: { h: string }) => (
    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
  )
  const DlBtn = ({ fn }: { fn: () => void }) => (
    <button onClick={fn} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>⬇ CSV</button>
  )

  if (loading) return <div style={{ padding: '36px 40px', color: MUTED }}>Loading reports…</div>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Reports</h1>
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', padding: 4, borderRadius: 10, border: BORDER, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const badge = t === 'Daily Due' ? dueToday.length : t === 'Overdue' ? overdue.length : 0
          const on = tab === t
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: on ? 700 : 400, background: on ? GOLD : 'transparent', color: on ? '#fff' : MUTED, whiteSpace: 'nowrap' }}>
              {t}
              {badge > 0 && <span style={{ marginLeft: 6, background: on ? 'rgba(255,255,255,.3)' : t === 'Overdue' ? '#FEE2E2' : '#FEF3D0', color: on ? '#fff' : t === 'Overdue' ? '#C03030' : '#856404', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* ── DAILY DUE ── */}
      {tab === 'Daily Due' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: MUTED }}>{dueToday.length} due today · {INR(dueToday.reduce((s, d) => s + d.enrollment.monthly_amount, 0))} expected</span>
            <DlBtn fn={() => dlCSV([['Customer','Enrollment','Mobile','Monthly','Due Day','Pending Months','Pending Amount'],
              ...dueToday.map(d => [d.customer?.full_name, d.enrollment.enrollment_id, d.customer?.mobile, d.enrollment.monthly_amount, d.dueDay, d.pending, d.pendingAmount])],
              `daily-due-${today.toISOString().split('T')[0]}.csv`)} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th h="Customer" /><Th h="Enrollment" /><Th h="Mobile" /><Th h="Monthly" /><Th h="Due Day" /><Th h="Pending Months" /><Th h="Pending Amount" /></tr></thead>
              <tbody>
                {dueToday.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No customers due today.</td></tr>
                  : dueToday.map(d => (
                    <tr key={d.enrollment.id}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><div style={{ fontWeight: 600, color: TEXT }}>{d.customer?.full_name}</div><div style={{ fontSize: 11, color: MUTED }}>{d.customer?.customer_id}</div></td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{d.enrollment.enrollment_id}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{d.customer?.mobile}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(d.enrollment.monthly_amount)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{d.dueDay}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: '#856404' }}>{d.pending}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: GOLD, fontSize: 13.5 }}>{INR(d.pendingAmount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── OVERDUE ── */}
      {tab === 'Overdue' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: MUTED }}>{overdue.length} overdue · {INR(overdue.reduce((s, d) => s + d.pendingAmount, 0))} total · worst first</span>
            <DlBtn fn={() => dlCSV([['Customer','Enrollment','Mobile','Monthly','Overdue Since','Days','Months','Pending Amount'],
              ...overdue.map(d => [d.customer?.full_name, d.enrollment.enrollment_id, d.customer?.mobile, d.enrollment.monthly_amount, FD(d.firstUnpaid), d.daysOD, d.overdueMonths, d.pendingAmount])],
              `overdue-${today.toISOString().split('T')[0]}.csv`)} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th h="Customer" /><Th h="Enrollment" /><Th h="Mobile" /><Th h="Monthly" /><Th h="Overdue Since" /><Th h="Days Overdue" /><Th h="Months Missed" /><Th h="Pending Amount" /></tr></thead>
              <tbody>
                {overdue.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No overdue accounts.</td></tr>
                  : overdue.map(d => {
                    const uc = d.daysOD > 60 ? '#C03030' : d.daysOD > 30 ? '#C05000' : '#856404'
                    const ub = d.daysOD > 60 ? '#FEE2E2' : d.daysOD > 30 ? '#FEF0E0' : '#FEF9E0'
                    return (
                      <tr key={d.enrollment.id}>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><div style={{ fontWeight: 600, color: TEXT }}>{d.customer?.full_name}</div><div style={{ fontSize: 11, color: MUTED }}>{d.customer?.customer_id}</div></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{d.enrollment.enrollment_id}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{d.customer?.mobile}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(d.enrollment.monthly_amount)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: uc, fontSize: 13, whiteSpace: 'nowrap' }}>{FD(d.firstUnpaid)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><span style={{ padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: ub, color: uc }}>{d.daysOD}d</span></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 600, color: uc, fontSize: 13 }}>{d.overdueMonths} mo</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: '#C03030', fontSize: 13.5 }}>{INR(d.pendingAmount)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MONTHLY FORECAST ── */}
      {tab === 'Monthly Forecast' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13.5, color: MUTED }}>Foreseeable collection — <strong style={{ color: TEXT }}>{monthName}</strong></span>
            <DlBtn fn={() => dlCSV([['Customer','Enrollment','Mobile','Monthly','Pending Months','Pending Amount','Due Date','Status'],
              ...monthlyStatus.map(m => [m.customer?.full_name, m.enrollment.enrollment_id, m.customer?.mobile, m.enrollment.monthly_amount, m.pendingMo, m.pendingAmt, FD(m.dueThisMo), m.status])],
              `forecast-${today.toISOString().split('T')[0]}.csv`)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
            {[
              { label: 'Total Pending (All Months)',    value: INR(totalOutstanding),    color: totalOutstanding > 0 ? '#C05000' : '#1A7A3A', bg: '#fff',    sub: monthlyStatus.filter(m => m.pendingMo > 0).length + ' enrollments have balance' },
              { label: 'Received This Month',  value: INR(collectedThisMonth),  color: '#1A7A3A', bg: '#F0FFF4', sub: 'Received in ' + monthName },
              { label: 'Still to Collect This Month', value: INR(Math.max(0, totalMRR - collectedThisMonth)), color: (totalMRR - collectedThisMonth) > 0 ? '#C05000' : '#1A7A3A', bg: (totalMRR - collectedThisMonth) > 0 ? '#FEF0E0' : '#F0FFF4', sub: (totalMRR - collectedThisMonth) <= 0 ? 'All collected ✓' : `MRR ${INR(totalMRR)} − received ${INR(collectedThisMonth)}` },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, border: BORDER, padding: '20px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: c.color, marginBottom: 4 }}>{c.value}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '14px 18px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginBottom: 7 }}>
              <span>{paidCount} of {enrollments.length} enrollments fully settled</span>
              <span style={{ fontWeight: 700, color: TEXT }}>{INR(collectedThisMonth)} received this month</span>
            </div>
            <div style={{ height: 10, background: '#F0EAE0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: duePct + '%', background: 'linear-gradient(90deg, #C09428, #D4A832)', borderRadius: 10 }} />
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th h="Customer" /><Th h="Enrollment" /><Th h="Mobile" /><Th h="Monthly" /><Th h="Pending Months" /><Th h="Pending Amount" /><Th h="Due Date" /><Th h="Status" /></tr></thead>
              <tbody>
                {monthlyStatus.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No active enrollments.</td></tr>
                  : monthlyStatus.map(m => (
                    <tr key={m.enrollment.id}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><div style={{ fontWeight: 600, color: TEXT }}>{m.customer?.full_name}</div><div style={{ fontSize: 11, color: MUTED }}>{m.customer?.customer_id}</div></td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{m.enrollment.enrollment_id}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{m.customer?.mobile}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(m.enrollment.monthly_amount)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13, fontWeight: 600, color: m.pendingMo > 1 ? '#C03030' : m.pendingMo === 1 ? '#856404' : '#1A7A3A' }}>
                        {m.pendingMo <= 0 ? '—' : m.pendingMo + ' mo'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: m.pendingMo <= 0 ? MUTED : GOLD, fontSize: 13.5 }}>
                        {m.pendingMo <= 0 ? '—' : INR(m.pendingAmt)}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{FD(m.dueThisMo)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        {m.status === 'paid'          && <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: '#F0FFF4', color: '#1A7A3A', border: '1px solid #6EC68A' }}>✓ Paid / Advance</span>}
                        {m.status === 'upcoming'      && <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: '#EEF6FF', color: '#1A5FB4', border: '1px solid #93C5FD' }}>Due {FD(m.dueThisMo)}</span>}
                        {m.status === 'overdue_month' && <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: '#FEE2E2', color: '#C03030', border: '1px solid #FECACA' }}>⚠ Overdue{m.pendingMo > 1 ? ` (${m.pendingMo} mo)` : ''}</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'Payments' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: MUTED }}>{payments.length} payments · {INR(payments.reduce((s, p) => s + p.amount_received, 0))} total</span>
            <DlBtn fn={() => dlCSV([['Payment ID','Customer','Enrollment','Mobile','Date','Months','Mode','Amount','Covers'],
              ...payments.map(p => { const cv = paymentCoverage[p.id]; return [p.payment_id, p.enrollments?.customers?.full_name ?? p.customers?.full_name, p.enrollments?.enrollment_id ?? '—', p.enrollments?.customers?.mobile ?? p.customers?.mobile, FD(p.payment_date), p.months_paid_for, MODE_LABEL[p.payment_mode ?? 'cash'] ?? 'Cash', p.amount_received, cv?.label ?? ''] })],
              `payments-${today.toISOString().split('T')[0]}.csv`)} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th h="Payment ID" /><Th h="Customer" /><Th h="Enrollment" /><Th h="Date" /><Th h="Months" /><Th h="Mode" /><Th h="Amount" /><Th h="Payment Covers" /><Th h="Remarks" /></tr></thead>
              <tbody>
                {payments.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No payments yet.</td></tr>
                  : payments.map(p => {
                    const cv = paymentCoverage[p.id]
                    return (
                      <tr key={p.id}>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{p.payment_id}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                          <div style={{ fontWeight: 600, color: TEXT }}>{p.enrollments?.customers?.full_name ?? p.customers?.full_name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{p.enrollments?.customers?.customer_id ?? p.customers?.customer_id}</div>
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{p.enrollments?.enrollment_id ?? '—'}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{FD(p.payment_date)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{p.months_paid_for}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 700,
                            background: p.payment_mode === 'upi' ? '#EEF6FF' : p.payment_mode === 'cheque' ? '#FFF8E0' : p.payment_mode === 'bank_transfer' ? '#F0FFF4' : '#F5F5F5',
                            color:      p.payment_mode === 'upi' ? '#1A5FB4' : p.payment_mode === 'cheque' ? '#856404' : p.payment_mode === 'bank_transfer' ? '#1A7A3A' : '#555' }}>
                            {MODE_LABEL[p.payment_mode ?? 'cash'] ?? 'Cash'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: TEXT, fontSize: 13.5 }}>{INR(p.amount_received)}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                          {cv ? <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: cv.bg, color: cv.color, border: `1px solid ${cv.color}33`, whiteSpace: 'nowrap' }}>{cv.label}</span>
                              : <span style={{ fontSize: 12, color: MUTED }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 13 }}>{p.remarks || '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── CLOSED ── */}
      {tab === 'Closed' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13.5, color: MUTED }}>{closures.length} closed · {INR(closures.reduce((s, cl) => s + cl.final_amount, 0))} total</span>
            <DlBtn fn={() => dlCSV([['Customer','Enrollment','Mobile','Reason','Start Date','Closure Date','Months Paid','Total Paid','Final Amount'],
              ...closures.map(cl => [cl.enrollments?.customers?.full_name, cl.enrollments?.enrollment_id, cl.enrollments?.customers?.mobile, cl.reason, FD(cl.enrollments?.signup_date), FD(cl.closure_date), cl.months_paid, cl.total_amount_paid, cl.final_amount])],
              `closed-${today.toISOString().split('T')[0]}.csv`)} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th h="Customer" /><Th h="Enrollment" /><Th h="Reason" /><Th h="Start Date" /><Th h="Closure Date" /><Th h="Months Paid" /><Th h="Total Paid" /><Th h="Final Amount" /></tr></thead>
              <tbody>
                {closures.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No closed accounts yet.</td></tr>
                  : closures.map(cl => (
                    <tr key={cl.id}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        <div style={{ fontWeight: 600, color: TEXT }}>{cl.enrollments?.customers?.full_name}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>{cl.enrollments?.customers?.customer_id}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: GOLD, fontWeight: 600 }}>{cl.enrollments?.enrollment_id}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', background: cl.reason === 'completed' ? '#F0FFF4' : cl.reason === 'cancelled' ? '#FEE2E2' : '#F5F0FF', color: cl.reason === 'completed' ? '#1A7A3A' : cl.reason === 'cancelled' ? '#C03030' : MUTED }}>{cl.reason}</span>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{FD(cl.enrollments?.signup_date)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{FD(cl.closure_date)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{cl.months_paid}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{INR(cl.total_amount_paid)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: GOLD, fontSize: 13.5 }}>{INR(cl.final_amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
