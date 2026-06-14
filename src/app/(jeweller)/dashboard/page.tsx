'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TEXT = '#1A1008', MUTED = '#7A6A5A', GOLD = '#C09428', BORDER = '1px solid #E5DDD0', DARK = '#1B1108'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD   = (d: string) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Always extract just YYYY-MM-DD regardless of whether value is date or timestamp
const dateStr = (d: any) => !d ? '' : String(d).substring(0, 10)

const PERIODS = ['Today', 'Last 7 Days', 'Last 30 Days', 'Monthly'] as const
type Period   = typeof PERIODS[number]
type Detail   = 'enrollments'|'collected'|'closed-period'|'outstanding'|'behind'|'this-month'|'active'|'all-closures'|'foreclosures'|'redeemed'|'mer' | null

function getPaidMonths(enrollment: any, payments: any[]): number {
  return payments
    .filter((p: any) => {
      if (p.enrollment_id) return p.enrollment_id === enrollment.id
      return p.customer_id === enrollment.customer_id && !enrollment.enrollment_id?.startsWith('ENR-')
    })
    .reduce((s: number, p: any) => s + (p.months_paid_for || 1), 0)
}

function getPeriodStart(period: Period): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (period === 'Last 7 Days')  { d.setDate(d.getDate() - 6); return d }
  if (period === 'Last 30 Days') { d.setDate(d.getDate() - 29); return d }
  return d
}

// Bar Chart SVG
function BarChart({ data, year }: { data: { month: string; count: number; amount: number }[]; year: number }) {
  const maxCount  = Math.max(...data.map(d => d.count), 1)
  const maxAmount = Math.max(...data.map(d => d.amount), 1)
  const W = 900, H = 190, PAD = { top: 16, right: 16, bottom: 44, left: 40 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const groupW = chartW / 12
  const barW   = groupW * 0.28

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0,25,50,75,100].map(pct => (
        <line key={pct} x1={PAD.left} x2={W-PAD.right} y1={PAD.top + chartH*(1-pct/100)} y2={PAD.top + chartH*(1-pct/100)} stroke="#F0EAE0" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const gx = PAD.left + i * groupW
        const cH = maxCount  > 0 ? (d.count  / maxCount)  * chartH : 0
        const aH = maxAmount > 0 ? (d.amount / maxAmount) * chartH : 0
        const cx = gx + groupW * 0.15, ax = cx + barW + 4
        return (
          <g key={i}>
            <rect x={cx} y={PAD.top+chartH-cH} width={barW} height={Math.max(cH,1)} fill={DARK} rx="2" opacity="0.8" />
            <rect x={ax} y={PAD.top+chartH-aH} width={barW} height={Math.max(aH,1)} fill={GOLD} rx="2" opacity="0.8" />
            {d.count > 0 && cH > 14 && (
              <text x={cx+barW/2} y={PAD.top+chartH-cH+10} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">{d.count}</text>
            )}
            <text x={gx+groupW/2} y={H-PAD.bottom+13} textAnchor="middle" fontSize="10" fill={MUTED}>{d.month}</text>
            {d.amount > 0 && (
              <text x={gx+groupW/2} y={H-PAD.bottom+24} textAnchor="middle" fontSize="8" fill={MUTED}>
                {d.amount>=100000?(d.amount/100000).toFixed(1)+'L':d.amount>=1000?(d.amount/1000).toFixed(0)+'K':d.amount}
              </text>
            )}
          </g>
        )
      })}
      <rect x={PAD.left} y={H-8} width={8} height={7} fill={DARK} rx="1"/>
      <text x={PAD.left+11} y={H-2} fontSize="9" fill={MUTED}>Enrollments (count)</text>
      <rect x={PAD.left+110} y={H-8} width={8} height={7} fill={GOLD} rx="1"/>
      <text x={PAD.left+121} y={H-2} fontSize="9" fill={MUTED}>Monthly contribution (₹)</text>
    </svg>
  )
}

// Detail Modal
function DetailModal({ title, onClose, children }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: BORDER }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: MUTED, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 22px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function DRow({ cols }: { cols: (string | number | React.ReactNode)[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), gap: 8, padding: '9px 0', borderBottom: BORDER, fontSize: 13, color: TEXT, alignItems: 'center' }}>
      {cols.map((c, i) => <div key={i}>{c}</div>)}
    </div>
  )
}

function DHead({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), gap: 8, padding: '0 0 8px', borderBottom: BORDER, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {cols.map(c => <div key={c}>{c}</div>)}
    </div>
  )
}

// Clickable Card
function Card({ label, value, sub, redValue = false, onClick, hint }: any) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: hover ? '#FAFAF8' : '#fff', borderRadius: 10, border: hover ? '1px solid #C09428' : BORDER, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default', transition: 'all .15s', position: 'relative' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: redValue ? '#C03030' : TEXT, marginBottom: sub ? 5 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>{sub}</div>}
      {onClick && <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: hover ? GOLD : 'transparent', fontWeight: 600 }}>Details →</div>}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [period,      setPeriod]      = useState<Period>('Today')
  const [loading,     setLoading]     = useState(true)
  const [activeDetail, setDetail]     = useState<Detail>(null)
  const [shopName,    setShopName]    = useState('')
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments,    setPayments]    = useState<any[]>([])
  const [closures,    setClosures]    = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id
    const [{ data: t }, { data: en }, { data: pa }, { data: cl }] = await Promise.all([
      supabase.from('tenants').select('shop_name').eq('id', tid).single(),
      supabase.from('enrollments').select('id,enrollment_id,customer_id,monthly_amount,signup_date,status,created_at,customers(full_name,customer_id,mobile)').eq('tenant_id', tid),
      supabase.from('payments').select('id,enrollment_id,customer_id,months_paid_for,amount_received,payment_date,payment_mode').eq('tenant_id', tid),
      supabase.from('account_closures').select('id,final_amount,closure_date,reason,total_amount_paid,months_paid,enrollments(enrollment_id,customers(full_name,customer_id))').eq('tenant_id', tid).order('closure_date', { ascending: false }),
    ])
    setShopName(t?.shop_name ?? ''); setEnrollments(en ?? []); setPayments(pa ?? []); setClosures(cl ?? [])
    setLoading(false)
  }

  const today   = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  // Build from local date components — toISOString() converts to UTC which gives wrong date in IST
  const todayISO = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-')
  const year     = today.getFullYear()
  const pStart   = useMemo(() => getPeriodStart(period), [period])

  const active = enrollments.filter(e => e.status === 'active')

  // ── FIXED: overdue = due dates STRICTLY before today that are unpaid ──
  let totalOutstanding = 0
  const behindList: any[]      = []
  const outstandingList: any[] = []

  for (const e of active) {
    const signup = new Date(e.signup_date + 'T00:00:00')
    const dueDay = signup.getDate()

    // All due dates up to and including today
    const allDueDates: Date[] = []; let cur = new Date(signup)
    while (cur <= today) { allDueDates.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, dueDay) }

    // Past due dates = strictly before today (these are overdue if unpaid)
    const pastDueDates = allDueDates.filter(d => d < today)

    const paid    = getPaidMonths(e, payments)
    const pending = Math.max(0, allDueDates.length - paid)

    if (pending > 0) {
      const pendingAmt = pending * e.monthly_amount
      totalOutstanding += pendingAmt
      outstandingList.push({ ...e, pending, pendingAmt })

      // "Behind" = has unpaid months BEFORE today (strictly overdue)
      const overdueMonths = Math.max(0, pastDueDates.length - paid)
      if (overdueMonths > 0) {
        behindList.push({ ...e, overdueMonths, pendingAmt })
      }
    }
  }
  outstandingList.sort((a, b) => b.pendingAmt - a.pendingAmt)
  behindList.sort((a, b) => b.overdueMonths - a.overdueMonths)

  // ── Monthly Expected Revenue ──
  const monthStart         = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const collectedThisMonth = payments.filter(p => dateStr(p.payment_date) >= monthStart && dateStr(p.payment_date) <= todayISO).reduce((s, p) => s + p.amount_received, 0)
  const totalMRR           = active.reduce((s, e) => s + e.monthly_amount, 0)
  const mer                = Math.max(0, totalMRR - collectedThisMonth)

  // MER detail: per customer, did they pay this month?
  const merList = active.map(e => {
    const paidThisMonth = payments
      .filter(p => (p.enrollment_id === e.id || p.customer_id === e.customer_id) && dateStr(p.payment_date) >= monthStart)
      .reduce((s, p) => s + p.amount_received, 0)
    return { ...e, paidThisMonth, remaining: Math.max(0, e.monthly_amount - paidThisMonth) }
  }).sort((a, b) => b.remaining - a.remaining)

  // ── Period-filtered ──
  const enrolledInPeriod  = enrollments.filter(e => e.created_at && new Date(e.created_at) >= pStart)
  const paymentsInPeriod  = payments.filter(p => { const d = dateStr(p.payment_date); return d && new Date(d + 'T00:00:00') >= pStart })
  const closuresInPeriod  = closures.filter(c => c.closure_date && new Date(c.closure_date + 'T00:00:00') >= pStart)
  const collectedInPeriod = paymentsInPeriod.reduce((s, p) => s + p.amount_received, 0)

  // ── Closures split ──
  // Closure = completed full tenure, Foreclosure = cancelled abruptly, Redeemed = early voluntary exit
  const completed    = closures.filter(c => c.reason === 'completed')
  const foreclosures = closures.filter(c => c.reason === 'cancelled')
  const redeemed     = closures.filter(c => c.reason === 'redeemed')

  // ── Monthly calendar data (strict Jan 1 - Jan 31 etc.) ──
  const monthlyCalData = MONTHS.map((mon, idx) => {
    const mStart = `${year}-${String(idx + 1).padStart(2, '0')}-01`
    const mEnd   = `${year}-${String(idx + 1).padStart(2, '0')}-${new Date(year, idx + 1, 0).getDate().toString().padStart(2,'0')}`
    const monEnrollments = enrollments.filter(e => { const d = dateStr(e.signup_date); return d >= mStart && d <= mEnd })
    const monPayments    = payments.filter(p => { const d = dateStr(p.payment_date); return d >= mStart && d <= mEnd })
    const monClosures    = closures.filter(cl => { const d = dateStr(cl.closure_date); return d >= mStart && d <= mEnd && cl.reason === 'completed' })
    const monForeclosures = closures.filter(cl => { const d = dateStr(cl.closure_date); return d >= mStart && d <= mEnd && cl.reason === 'cancelled' })
    return {
      month: mon, idx,
      enrollments:    monEnrollments.length,
      enrollAmt:      monEnrollments.reduce((s, e) => s + e.monthly_amount, 0),
      collected:      monPayments.reduce((s, p) => s + p.amount_received, 0),
      closures:       monClosures.length,
      foreclosures:   monForeclosures.length,
      isCurrent:      idx === today.getMonth(),
      isFuture:       idx > today.getMonth(),
    }
  })

  // ── Bar chart ──
  const chartData = MONTHS.map((month, idx) => {
    const prefix = `${year}-${String(idx + 1).padStart(2, '0')}`
    const me = enrollments.filter(e => e.signup_date?.startsWith(prefix))
    return { month, count: me.length, amount: me.reduce((s, e) => s + e.monthly_amount, 0) }
  })

  // ── Detail modal content ──
  function renderDetail() {
    switch (activeDetail) {
      case 'enrollments':
        return (
          <DetailModal title={`New Enrollments — ${period}`} onClose={() => setDetail(null)}>
            {enrolledInPeriod.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>No new enrollments in this period.</div> : (
              <>
                <DHead cols={['Customer', 'Enrollment ID', 'Monthly', 'Start Date']} />
                {enrolledInPeriod.map(e => (
                  <DRow key={e.id} cols={[(e.customers as any)?.full_name ?? '—', e.enrollment_id, INR(e.monthly_amount), FD(e.signup_date)]} />
                ))}
              </>
            )}
          </DetailModal>
        )
      case 'collected':
        return (
          <DetailModal title={`Payments — ${period}`} onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: GOLD }}>{INR(collectedInPeriod)} total · {paymentsInPeriod.length} payments</div>
            {paymentsInPeriod.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>No payments in this period.</div> : (
              <>
                <DHead cols={['Date', 'Months', 'Mode', 'Amount']} />
                {paymentsInPeriod.sort((a,b)=>b.payment_date.localeCompare(a.payment_date)).map(p => (
                  <DRow key={p.id} cols={[FD(p.payment_date), p.months_paid_for + ' mo', p.payment_mode ?? 'Cash', <span style={{ fontWeight: 700, color: GOLD }}>{INR(p.amount_received)}</span>]} />
                ))}
              </>
            )}
          </DetailModal>
        )
      case 'closed-period':
        return (
          <DetailModal title={`Closures — ${period}`} onClose={() => setDetail(null)}>
            {closuresInPeriod.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>No closures in this period.</div> : (
              <>
                <DHead cols={['Customer', 'Date', 'Reason', 'Final']} />
                {closuresInPeriod.map(c => (
                  <DRow key={c.id} cols={[(c.enrollments as any)?.customers?.full_name ?? '—', FD(c.closure_date), c.reason, <span style={{ fontWeight: 700, color: GOLD }}>{INR(c.final_amount)}</span>]} />
                ))}
              </>
            )}
          </DetailModal>
        )
      case 'outstanding':
        return (
          <DetailModal title="Total Outstanding Dues — All Active Accounts" onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#C03030' }}>{INR(totalOutstanding)} total pending</div>
            <DHead cols={['Customer', 'Monthly', 'Pending Months', 'Pending Amount']} />
            {outstandingList.map(e => (
              <DRow key={e.id} cols={[
                <div><div style={{ fontWeight: 600 }}>{(e.customers as any)?.full_name ?? '—'}</div><div style={{ fontSize: 11, color: MUTED }}>{(e.customers as any)?.mobile}</div></div>,
                INR(e.monthly_amount),
                e.pending + ' mo',
                <span style={{ fontWeight: 700, color: '#C03030' }}>{INR(e.pendingAmt)}</span>
              ]} />
            ))}
          </DetailModal>
        )
      case 'behind':
        return (
          <DetailModal title="Customers Behind on Payments" onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 8, fontSize: 12.5, color: MUTED }}>Only customers with past months unpaid (not counting today's dues)</div>
            {behindList.length === 0 ? <div style={{ color: '#1A7A3A', fontWeight: 600, fontSize: 13 }}>✓ All customers are up to date</div> : (
              <>
                <DHead cols={['Customer', 'Monthly', 'Months Overdue', 'Total Pending']} />
                {behindList.map(e => (
                  <DRow key={e.id} cols={[
                    <div><div style={{ fontWeight: 600 }}>{(e.customers as any)?.full_name ?? '—'}</div><div style={{ fontSize: 11, color: MUTED }}>{(e.customers as any)?.mobile}</div></div>,
                    INR(e.monthly_amount),
                    <span style={{ fontWeight: 700, color: '#C03030' }}>{e.overdueMonths} mo</span>,
                    <span style={{ fontWeight: 700, color: '#C03030' }}>{INR(e.pendingAmt)}</span>
                  ]} />
                ))}
              </>
            )}
          </DetailModal>
        )
      case 'this-month':
        return (
          <DetailModal title="This Month's Collection Breakdown" onClose={() => setDetail(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[['Expected (MRR)', INR(totalMRR), TEXT], ['Received', INR(collectedThisMonth), '#1A7A3A'], ['Still to Collect', INR(mer), '#C05000']].map(([l,v,col])=>(
                <div key={l} style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: col, fontFamily: 'var(--font-cormorant),serif' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Per customer — this month status</div>
            <DHead cols={['Customer', 'Monthly Due', 'Paid This Month', 'Remaining']} />
            {merList.map(e => (
              <DRow key={e.id} cols={[
                (e.customers as any)?.full_name ?? '—',
                INR(e.monthly_amount),
                e.paidThisMonth > 0 ? <span style={{ color: '#1A7A3A', fontWeight: 600 }}>{INR(e.paidThisMonth)} ✓</span> : <span style={{ color: MUTED }}>—</span>,
                e.remaining > 0 ? <span style={{ fontWeight: 700, color: GOLD }}>{INR(e.remaining)}</span> : <span style={{ color: '#1A7A3A' }}>Settled</span>
              ]} />
            ))}
          </DetailModal>
        )
      case 'redeemed':
        return (
          <DetailModal title={`Early Redemptions (${redeemed.length})`} onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 12, fontSize: 12.5, color: MUTED }}>Customers who voluntarily redeemed early before completing the full tenure.</div>
            {redeemed.length === 0 ? <div style={{ color: '#1A7A3A', fontSize: 13 }}>No early redemptions.</div>
            : (<>
              <DHead cols={['Customer', 'Closed On', 'Months Paid', 'Final Amount']} />
              {redeemed.map(c => (
                <DRow key={c.id} cols={[(c.enrollments as any)?.customers?.full_name ?? '—', FD(c.closure_date), c.months_paid + ' mo', <span style={{ fontWeight: 700, color: GOLD }}>{INR(c.final_amount)}</span>]} />
              ))}
            </>)}
          </DetailModal>
        )
      case 'mer':
        return (
          <DetailModal title="Monthly Expected Revenue Breakdown" onClose={() => setDetail(null)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[['Total MRR', INR(totalMRR)], ['Collected', INR(collectedThisMonth)], ['Still Due', INR(mer)]].map(([l,v])=>(
                <div key={l} style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: 'var(--font-cormorant),serif' }}>{v}</div>
                </div>
              ))}
            </div>
            <DHead cols={['Customer', 'Monthly', 'Paid This Month', 'Remaining']} />
            {merList.map(e => (
              <DRow key={e.id} cols={[
                (e.customers as any)?.full_name ?? '—',
                INR(e.monthly_amount),
                e.paidThisMonth > 0 ? <span style={{ color: '#1A7A3A', fontWeight: 600 }}>{INR(e.paidThisMonth)} ✓</span> : <span style={{ color: MUTED }}>—</span>,
                e.remaining > 0 ? <span style={{ fontWeight: 700, color: GOLD }}>{INR(e.remaining)}</span> : <span style={{ color: '#1A7A3A' }}>Paid</span>
              ]} />
            ))}
          </DetailModal>
        )
      case 'active':
        return (
          <DetailModal title={`Active Subscriptions (${active.length})`} onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 12, fontSize: 13, color: MUTED }}>Total MRR: <strong style={{ color: GOLD }}>{INR(totalMRR)}/month</strong></div>
            <DHead cols={['Customer', 'Enrollment', 'Monthly', 'Since']} />
            {active.map(e => (
              <DRow key={e.id} cols={[
                <div><div style={{ fontWeight: 600 }}>{(e.customers as any)?.full_name ?? '—'}</div><div style={{ fontSize: 11, color: MUTED }}>{(e.customers as any)?.mobile}</div></div>,
                <span style={{ fontSize: 11.5, color: MUTED }}>{e.enrollment_id}</span>,
                <span style={{ fontWeight: 700, color: GOLD }}>{INR(e.monthly_amount)}</span>,
                FD(e.signup_date)
              ]} />
            ))}
          </DetailModal>
        )
      case 'all-closures':
        return (
          <DetailModal title={`Completions — Full Tenure Completed (${completed.length})`} onClose={() => setDetail(null)}>
            <DHead cols={['Customer', 'Closed On', 'Months', 'Final Amount']} />
            {completed.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>No completed closures yet.</div>
            : completed.map(c => (
              <DRow key={c.id} cols={[(c.enrollments as any)?.customers?.full_name ?? '—', FD(c.closure_date), c.months_paid + ' mo', <span style={{ fontWeight: 700, color: GOLD }}>{INR(c.final_amount)}</span>]} />
            ))}
          </DetailModal>
        )
      case 'foreclosures':
        return (
          <DetailModal title={`Foreclosures — Withdrew Early (${foreclosures.length})`} onClose={() => setDetail(null)}>
            <div style={{ marginBottom: 12, fontSize: 12.5, color: MUTED }}>Customers who abruptly stopped paying and did not complete the full scheme tenure.</div>
            <DHead cols={['Customer', 'Closed On', 'Reason', 'Final']} />
            {foreclosures.length === 0 ? <div style={{ color: '#1A7A3A', fontSize: 13 }}>No foreclosures.</div>
            : foreclosures.map(c => (
              <DRow key={c.id} cols={[
                (c.enrollments as any)?.customers?.full_name ?? '—',
                FD(c.closure_date),
                <span style={{ textTransform: 'capitalize', color: c.reason === 'cancelled' ? '#C03030' : '#5030A0' }}>{c.reason}</span>,
                <span style={{ fontWeight: 700, color: GOLD }}>{INR(c.final_amount)}</span>
              ]} />
            ))}
          </DetailModal>
        )
      default: return null
    }
  }

  if (loading) return <div style={{ padding: 40, color: MUTED }}>Loading…</div>

  return (
    <div style={{ padding: '28px 36px' }}>
      {activeDetail && renderDetail()}

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 26, fontWeight: 400, color: TEXT, display: 'block', marginBottom: 12 }}>{shopName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: MUTED }}>{today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <div style={{ display: 'flex', background: '#fff', border: BORDER, borderRadius: 9, padding: 3, gap: 2 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: period === p ? 700 : 400, background: period === p ? DARK : 'transparent', color: period === p ? '#fff' : MUTED }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1 — Period OR Monthly Performance */}
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {period === 'Monthly' ? `Monthly Performance — ${year}` : period === 'Today' ? 'Today' : period}
      </div>

      {period === 'Monthly' ? (
        /* ── Monthly calendar table ── */
        <div style={{ background: '#fff', borderRadius: 10, border: BORDER, marginBottom: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F5F0E6' }}>
                {['Month', 'New Enrollments', 'Enrol. Value', 'Collected', 'Completions', 'Foreclosures'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyCalData.map(m => (
                <tr key={m.month} style={{ background: m.isCurrent ? '#FBF8F0' : '#fff', opacity: m.isFuture ? 0.35 : 1 }}>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, fontWeight: m.isCurrent ? 700 : 500, color: TEXT, fontSize: 13 }}>
                    {m.month}{m.isCurrent && <span style={{ marginLeft: 6, fontSize: 10, background: GOLD, color: '#fff', borderRadius: 4, padding: '1px 6px' }}>Now</span>}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, color: TEXT, fontSize: 13 }}>{m.enrollments > 0 ? m.enrollments : <span style={{ color: MUTED }}>—</span>}</td>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, color: m.enrollAmt > 0 ? TEXT : MUTED, fontSize: 13 }}>{m.enrollAmt > 0 ? INR(m.enrollAmt) + '/mo' : '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, fontWeight: m.collected > 0 ? 700 : 400, color: m.collected > 0 ? GOLD : MUTED, fontSize: 13 }}>{m.collected > 0 ? INR(m.collected) : '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, color: m.closures > 0 ? '#1A7A3A' : MUTED, fontSize: 13 }}>{m.closures > 0 ? m.closures : '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: BORDER, color: m.foreclosures > 0 ? '#C03030' : MUTED, fontSize: 13 }}>{m.foreclosures > 0 ? m.foreclosures : '—'}</td>
                </tr>
              ))}
              {/* Year total row */}
              <tr style={{ background: '#F5F0E6', fontWeight: 700 }}>
                <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: TEXT }}>Total {year}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: TEXT }}>{monthlyCalData.reduce((s,m)=>s+m.enrollments,0)}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: TEXT }}>{INR(monthlyCalData.reduce((s,m)=>s+m.enrollAmt,0))}/mo</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: GOLD }}>{INR(monthlyCalData.reduce((s,m)=>s+m.collected,0))}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: '#1A7A3A' }}>{monthlyCalData.reduce((s,m)=>s+m.closures,0)}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: '#C03030' }}>{monthlyCalData.reduce((s,m)=>s+m.foreclosures,0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Period cards ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Card label="New Enrollments" value={enrolledInPeriod.length}
            sub={enrolledInPeriod.length > 0 ? enrolledInPeriod.slice(0,2).map(e=>(e.customers as any)?.full_name).filter(Boolean).join(', ') : 'None in this period'}
            onClick={() => setDetail('enrollments')} />
          <Card label="Amount Collected" value={INR(collectedInPeriod)}
            sub={paymentsInPeriod.length > 0 ? `${paymentsInPeriod.length} payment${paymentsInPeriod.length > 1 ? 's' : ''}` : 'No payments'}
            onClick={() => setDetail('collected')} />
          <Card label="Accounts Closed" value={closuresInPeriod.length}
            sub={closuresInPeriod.length > 0 ? INR(closuresInPeriod.reduce((s,c)=>s+c.final_amount,0)) + ' disbursed' : 'No closures in this period'}
            onClick={() => setDetail('closed-period')} />
        </div>
      )}

      {/* Row 2 — Outstanding + Behind + MER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Card label="Total Outstanding Dues" value={INR(totalOutstanding)}
          sub={`All unpaid months across ${active.length} active accounts`}
          redValue={totalOutstanding > 0}
          onClick={() => setDetail('outstanding')} />

        {/* Behind — inline list card */}
        <div
          onClick={() => setDetail('behind')}
          style={{ background: '#fff', borderRadius: 10, border: BORDER, padding: '18px 20px', cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GOLD }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E5DDD0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Customers Behind on Payments</div>
          <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: '#ccc', fontWeight: 600 }}>Details →</div>
          {behindList.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#1A7A3A', fontWeight: 600 }}>✓ All up to date</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {behindList.slice(0, 4).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{(e.customers as any)?.full_name ?? '—'}</span>
                    <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>{e.overdueMonths} mo</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C03030' }}>{INR(e.pendingAmt)}</span>
                </div>
              ))}
              {behindList.length > 4 && <div style={{ fontSize: 11, color: MUTED }}>+{behindList.length - 4} more</div>}
            </div>
          )}
        </div>

        {/* This Month's Collection card */}
        <div
          onClick={() => setDetail('this-month')}
          style={{ background: '#fff', borderRadius: 10, border: BORDER, padding: '18px 20px', cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = GOLD }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E5DDD0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>This Month's Collection</div>
          <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 11, color: '#ccc', fontWeight: 600 }}>Details →</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: MUTED }}>Expected (MRR)</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{INR(totalMRR)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: MUTED }}>Received so far</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A7A3A' }}>{INR(collectedThisMonth)}</span>
            </div>
            <div style={{ height: 1, background: '#F0EAE0', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>Still to collect</span>
              <span style={{ fontSize: 20, fontFamily: 'var(--font-cormorant),serif', fontWeight: 400, color: mer > 0 ? '#C05000' : '#1A7A3A' }}>{INR(mer)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
        <Card label="Total Active Subscriptions" value={active.length}
          sub={`${enrollments.length} enrolled ever · ${INR(totalMRR)}/mo`}
          onClick={() => setDetail('active')} />
        <Card label="Completions (Full Tenure)" value={completed.length}
          sub={`${INR(completed.reduce((s,c)=>s+c.final_amount,0))} disbursed`}
          onClick={() => setDetail('all-closures')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card label="Foreclosures (Stopped Early)" value={foreclosures.length}
            sub="Cancelled before completing tenure"
            redValue={foreclosures.length > 0}
            onClick={() => setDetail('foreclosures')} />
          <Card label="Early Redemptions" value={redeemed.length}
            sub={redeemed.length > 0 ? INR(redeemed.reduce((s,c)=>s+c.final_amount,0)) + ' paid out' : 'None'}
            onClick={() => setDetail('redeemed')} />
        </div>
      </div>

      {/* Row 4 — Bar chart */}
      <div style={{ background: '#fff', borderRadius: 10, border: BORDER, padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Enrollment Trends · {year}</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>Monthly enrollment count and total monthly contribution</div>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED }}>
            {year} total: <strong style={{ color: TEXT }}>{enrollments.filter(e=>e.signup_date?.startsWith(String(year))).length}</strong> enrollments ·{' '}
            <strong style={{ color: GOLD }}>{INR(enrollments.filter(e=>e.signup_date?.startsWith(String(year))).reduce((s,e)=>s+e.monthly_amount,0))}/mo</strong>
          </div>
        </div>
        <BarChart data={chartData} year={year} />
      </div>
    </div>
  )
}
