'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD   = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function MonthEndReportPage() {
  const supabase  = createClient()
  const router    = useRouter()
  const now       = new Date()
  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth())   // 0-based
  const [shopName,setShopName]= useState('')
  const [payments,setPayments]= useState<any[]>([])
  const [closures,setClosures]= useState<any[]>([])
  const [enrMap,  setEnrMap]  = useState<Record<string,any>>({})
  const [custMap, setCustMap] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [year, month])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id

    const start = `${year}-${String(month + 1).padStart(2,'0')}-01`
    const end   = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const [{ data: tenant }, { data: pays }, { data: closrs }, { data: enrs }, { data: custs }] = await Promise.all([
      supabase.from('tenants').select('shop_name,owner_name,mobile,gstin,address,city').eq('id', tid).single(),
      supabase.from('payments').select('*').eq('tenant_id', tid).gte('payment_date', start).lte('payment_date', end).order('payment_date'),
      supabase.from('account_closures').select('*').eq('tenant_id', tid).gte('closure_date', start).lte('closure_date', end).order('closure_date'),
      supabase.from('enrollments').select('id,enrollment_id,customer_id,monthly_amount').eq('tenant_id', tid),
      supabase.from('customers').select('id,full_name,mobile').eq('tenant_id', tid),
    ])

    setShopName(tenant?.shop_name ?? '')
    setPayments(pays ?? [])
    setClosures(closrs ?? [])

    const em: Record<string,any> = {}
    for (const e of (enrs ?? [])) em[e.id] = e
    setEnrMap(em)

    const cm: Record<string,any> = {}
    for (const c of (custs ?? [])) cm[c.id] = c
    setCustMap(cm)
    setLoading(false)
  }

  // ── Derived data ──────────────────────────────────────────────
  const monthLabel = `${MONTHS[month]} ${year}`

  const enrichedPayments = useMemo(() => payments.map(p => {
    const enr  = enrMap[p.enrollment_id ?? ''] ?? {}
    const cust = custMap[p.customer_id ?? ''] ?? {}
    return { ...p, customerName: cust.full_name ?? '—', mobile: cust.mobile ?? '—', enrollmentId: enr.enrollment_id ?? '—', monthlyAmount: enr.monthly_amount ?? 0 }
  }), [payments, enrMap, custMap])

  const enrichedClosures = useMemo(() => closures.map(c => {
    const enr  = enrMap[c.enrollment_id ?? ''] ?? {}
    const cust = custMap[enr.customer_id ?? ''] ?? {}
    return { ...c, customerName: cust.full_name ?? '—', mobile: cust.mobile ?? '—', enrollmentId: enr.enrollment_id ?? '—' }
  }), [closures, enrMap, custMap])

  const totalCollected = payments.reduce((s, p) => s + p.amount_received, 0)
  const totalPaidOut   = closures.reduce((s, c) => s + c.final_amount, 0)
  const netCashFlow    = totalCollected - totalPaidOut

  // ── Download functions ────────────────────────────────────────
  function downloadCSV() {
    const rows = [
      ['Month-End Report', monthLabel, '', '', '', ''],
      ['Shop Name', shopName, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['COLLECTIONS', '', '', '', '', ''],
      ['Date', 'Customer', 'Mobile', 'Enrollment ID', 'Months', 'Mode', 'Amount'],
      ...enrichedPayments.map(p => [
        FD(String(p.payment_date).substring(0,10)),
        p.customerName, p.mobile, p.enrollmentId,
        p.months_paid_for, (p.payment_mode ?? 'cash').replace('_',' '),
        p.amount_received
      ]),
      ['', '', '', '', '', 'TOTAL COLLECTED', totalCollected],
      ['', '', '', '', '', '', ''],
      ['PAYOUTS / CLOSURES', '', '', '', '', '', ''],
      ['Date', 'Customer', 'Mobile', 'Enrollment ID', 'Months Paid', 'Reason', 'Amount'],
      ...enrichedClosures.map(c => [
        FD(String(c.closure_date).substring(0,10)),
        c.customerName, c.mobile, c.enrollmentId,
        c.months_paid, c.reason ?? '—', c.final_amount
      ]),
      ['', '', '', '', '', 'TOTAL PAID OUT', totalPaidOut],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', 'NET CASH FLOW', netCashFlow],
    ]
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `SuvarnSetu_${monthLabel.replace(' ','_')}_Report.csv`
    a.click()
  }

  function downloadTallyXML() {
    const tallyDate = (d: string) => String(d).substring(0,10).replace(/-/g,'')

    const paymentVouchers = enrichedPayments.map(p => {
      const mode = (p.payment_mode ?? 'cash').toLowerCase()
      const ledger = mode === 'upi' ? 'UPI Collections' : mode === 'cheque' ? 'Bank Account' : mode === 'bank_transfer' ? 'Bank Account' : 'Cash'
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="${p.payment_id}" VCHTYPE="Receipt" ACTION="Create">
            <DATE>${tallyDate(p.payment_date)}</DATE>
            <NARRATION>Gold SIP Collection - ${p.customerName} - ${p.enrollmentId}</NARRATION>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${p.payment_id}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${ledger}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${ledger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${p.amount_received}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Gold Scheme Collection</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${p.amount_received}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`
    }).join('\n')

    const closureVouchers = enrichedClosures.map(c => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="CLO-${c.id?.substring(0,8)}" VCHTYPE="Payment" ACTION="Create">
            <DATE>${tallyDate(c.closure_date)}</DATE>
            <NARRATION>Gold SIP Closure - ${c.customerName} - ${c.enrollmentId}</NARRATION>
            <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
            <VOUCHERNUMBER>CLO-${c.id?.substring(0,8)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Cash</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Gold Scheme Payouts</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${c.final_amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${c.final_amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <!-- SuvarnSetu Export: ${monthLabel} | ${shopName} -->
        <!-- Collections: ${payments.length} vouchers | Closures: ${closures.length} vouchers -->
        ${paymentVouchers}
        ${closureVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

    const a = document.createElement('a')
    a.href = 'data:text/xml;charset=utf-8,' + encodeURIComponent(xml)
    a.download = `SuvarnSetu_${monthLabel.replace(' ','_')}_Tally.xml`
    a.click()
  }

  // ── Render ────────────────────────────────────────────────────
  const TH = ({ c }: { c: string }) => (
    <th style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', background: '#F9F7F3' }}>{c}</th>
  )
  const TD = ({ c, bold, gold }: { c: any; bold?: boolean; gold?: boolean }) => (
    <td style={{ padding: '10px 14px', borderBottom: '1px solid #F5F0E6', fontSize: 13, fontWeight: bold ? 700 : 400, color: gold ? GOLD : TEXT }}>{c}</td>
  )

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } @page { margin: 12mm; } }`}</style>
      <div style={{ padding: '36px 40px' }}>

        {/* Header */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Month-End CA Report</h1>
            <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Generate monthly summary for your chartered accountant</p>
          </div>
        </div>

        {/* Controls */}
        <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 28, padding: '16px 20px', background: '#fff', borderRadius: 12, border: BORDER }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              style={{ border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 14, background: '#fff' }}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 14, background: '#fff' }}>
              {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button onClick={downloadCSV}
              style={{ background: '#1A7A3A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ↓ Excel / CSV
            </button>
            <button onClick={downloadTallyXML}
              style={{ background: '#1A5FB4', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ↓ Tally XML
            </button>
            <button onClick={() => window.print()}
              style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              🖨 Print PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>Loading...</div>
        ) : (
          <div id="report-content">

            {/* Print header */}
            <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: `2px solid ${GOLD}` }}>
              <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 26, fontWeight: 400, color: TEXT }}>{shopName}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div style={{ fontSize: 15, color: MUTED, fontWeight: 600 }}>Month-End Summary — {monthLabel}</div>
                <div style={{ fontSize: 12, color: MUTED }}>Generated: {new Date().toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            {/* Summary boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
              {[
                { label: 'Total Collected', value: INR(totalCollected), count: `${payments.length} payments`, color: '#1A7A3A' },
                { label: 'Total Paid Out', value: INR(totalPaidOut), count: `${closures.length} closures`, color: '#C03030' },
                { label: 'Net Cash Flow', value: INR(netCashFlow), count: netCashFlow >= 0 ? 'Surplus' : 'Deficit', color: netCashFlow >= 0 ? GOLD : '#C03030' },
              ].map(box => (
                <div key={box.label} style={{ background: '#F9F7F3', borderRadius: 10, border: BORDER, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{box.label}</div>
                  <div style={{ fontSize: 24, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: box.color, marginBottom: 4 }}>{box.value}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{box.count}</div>
                </div>
              ))}
            </div>

            {/* Collections table */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
                Collections — {monthLabel}
              </h2>
              <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><TH c="Date"/><TH c="Customer"/><TH c="Mobile"/><TH c="Enrollment"/><TH c="Mode"/><TH c="Amount"/></tr></thead>
                  <tbody>
                    {enrichedPayments.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No collections this month</td></tr>
                    ) : enrichedPayments.map(p => (
                      <tr key={p.id}>
                        <TD c={FD(String(p.payment_date).substring(0,10))} />
                        <TD c={p.customerName} bold />
                        <TD c={p.mobile} />
                        <TD c={p.enrollmentId} />
                        <TD c={(p.payment_mode ?? 'cash').replace('_',' ')} />
                        <TD c={INR(p.amount_received)} gold bold />
                      </tr>
                    ))}
                    {enrichedPayments.length > 0 && (
                      <tr style={{ background: '#FBF8F0' }}>
                        <td colSpan={5} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: TEXT, textAlign: 'right', borderTop: BORDER }}>Total Collected</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: '#1A7A3A', borderTop: BORDER }}>{INR(totalCollected)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Closures table */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
                Payouts / Scheme Closures — {monthLabel}
              </h2>
              <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><TH c="Date"/><TH c="Customer"/><TH c="Mobile"/><TH c="Enrollment"/><TH c="Reason"/><TH c="Amount Paid Out"/></tr></thead>
                  <tbody>
                    {enrichedClosures.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>No closures this month</td></tr>
                    ) : enrichedClosures.map(c => (
                      <tr key={c.id}>
                        <TD c={FD(String(c.closure_date).substring(0,10))} />
                        <TD c={c.customerName} bold />
                        <TD c={c.mobile} />
                        <TD c={c.enrollmentId} />
                        <TD c={c.reason ?? '—'} />
                        <TD c={INR(c.final_amount)} bold />
                      </tr>
                    ))}
                    {enrichedClosures.length > 0 && (
                      <tr style={{ background: '#FBF8F0' }}>
                        <td colSpan={5} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: TEXT, textAlign: 'right', borderTop: BORDER }}>Total Paid Out</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: '#C03030', borderTop: BORDER }}>{INR(totalPaidOut)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ paddingTop: 16, borderTop: BORDER, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED }}>
              <span>Generated by SuvarnSetu · app.suvarnsetu.com</span>
              <span style={{ color: GOLD, fontWeight: 600 }}>This is an internal management record — not a tax document</span>
            </div>

          </div>
        )}
      </div>
    </>
  )
}
