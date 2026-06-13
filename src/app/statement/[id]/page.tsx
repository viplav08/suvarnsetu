import PrintActions from './PrintActions'
import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD   = (d: string) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

export default async function StatementPage({ params, searchParams }: { params: { id: string }; searchParams: { year?: string } }) {
  const admin = createAdminClient()
  const year  = parseInt(searchParams?.year ?? String(new Date().getFullYear()))

  const { data: customer } = await admin
    .from('customers')
    .select('*, tenants(shop_name, mobile, address, city, logo_url, owner_name)')
    .eq('id', params.id)
    .single()

  if (!customer) notFound()

  const tenant = customer.tenants as any

  const { data: enrollments } = await admin
    .from('enrollments')
    .select('*')
    .eq('customer_id', params.id)
    .order('signup_date')

  const { data: allPayments } = await admin
    .from('payments')
    .select('*')
    .eq('customer_id', params.id)
    .order('payment_date')

  // Filter payments for selected year
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`
  const yearPayments = (allPayments ?? []).filter(p => {
    const d = String(p.payment_date).substring(0, 10)
    return d >= yearStart && d <= yearEnd
  })

  const totalYear    = yearPayments.reduce((s, p) => s + p.amount_received, 0)
  const totalAllTime = (allPayments ?? []).reduce((s, p) => s + p.amount_received, 0)
  const activeEnrollments = (enrollments ?? []).filter(e => e.status === 'active')
  const totalMRR = activeEnrollments.reduce((s, e) => s + e.monthly_amount, 0)

  // Group payments by enrollment
  const enrollmentMap: Record<string, typeof enrollments[0]> = {}
  for (const e of (enrollments ?? [])) enrollmentMap[e.id] = e

  const paysByEnrollment: Record<string, typeof allPayments> = {}
  for (const p of yearPayments) {
    const key = p.enrollment_id ?? p.customer_id
    if (!paysByEnrollment[key]) paysByEnrollment[key] = []
    paysByEnrollment[key].push(p)
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; background: white; }
          .no-print { display: none !important; }
          @page { margin: 12mm; size: A4; }
        }
        body { font-family: Georgia, serif; background: #F5F0E6; }
      `}</style>

      <PrintActions />

      <div style={{ maxWidth: 740, margin: '32px auto', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.10)' }}>
        {/* Gold top border */}
        <div style={{ height: 6, background: `linear-gradient(90deg, ${GOLD}, #E8C566, ${GOLD})` }} />

        <div style={{ padding: '32px 44px' }}>

          {/* Shop header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: `2px solid #E5DDD0` }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: TEXT }}>{tenant?.shop_name}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.8, marginTop: 4 }}>
                {tenant?.address}{tenant?.city ? `, ${tenant.city}` : ''}<br />
                {tenant?.mobile && `📞 ${tenant.mobile}`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Account Statement</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Year {year}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Generated: {FD(new Date().toISOString().split('T')[0])}</div>
            </div>
          </div>

          {/* Customer details */}
          <div style={{ background: '#FBF8F0', borderRadius: 10, border: BORDER, padding: '16px 20px', marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              ['Customer Name',  customer.full_name],
              ['Customer ID',    customer.customer_id],
              ['Mobile',         customer.mobile],
              ['Total Enrolled', `${(enrollments ?? []).length} scheme${(enrollments?.length ?? 0) !== 1 ? 's' : ''}`],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Year summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { label: `Paid in ${year}`, value: INR(totalYear), color: GOLD },
              { label: 'All Time Total', value: INR(totalAllTime), color: TEXT },
              { label: 'Active Monthly', value: totalMRR > 0 ? INR(totalMRR) + '/mo' : 'No active scheme', color: '#1A7A3A' },
            ].map(c => (
              <div key={c.label} style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontFamily: 'Georgia, serif', fontWeight: 400, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Payments by enrollment */}
          {yearPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 14, fontStyle: 'italic' }}>
              No payments recorded for {year}.
            </div>
          ) : (
            Object.entries(paysByEnrollment).map(([key, pays]) => {
              const enrollment = enrollmentMap[key] ?? (enrollments ?? []).find(e => e.customer_id === key)
              const subtotal   = pays.reduce((s, p) => s + p.amount_received, 0)
              return (
                <div key={key} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#1B1108', borderRadius: '8px 8px 0 0' }}>
                    <div>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{enrollment?.enrollment_id ?? key}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 10 }}>{enrollment?.scheme_duration_months ?? 11}+1 months · {INR(enrollment?.monthly_amount ?? 0)}/month</span>
                    </div>
                    <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{INR(subtotal)}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER, borderTop: 'none' }}>
                    <thead>
                      <tr style={{ background: '#F9F7F3' }}>
                        {['Date', 'Payment ID', 'Mode', 'Months', 'Amount'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pays.map((p, i) => (
                        <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#FDFAF6' }}>
                          <td style={{ padding: '10px 14px', borderBottom: BORDER, fontSize: 13 }}>{FD(String(p.payment_date).substring(0, 10))}</td>
                          <td style={{ padding: '10px 14px', borderBottom: BORDER, fontSize: 12, color: MUTED }}>{p.payment_id}</td>
                          <td style={{ padding: '10px 14px', borderBottom: BORDER, fontSize: 12, color: MUTED, textTransform: 'capitalize' }}>{(p.payment_mode ?? 'cash').replace('_', ' ')}</td>
                          <td style={{ padding: '10px 14px', borderBottom: BORDER, fontSize: 13, textAlign: 'center' }}>{p.months_paid_for}</td>
                          <td style={{ padding: '10px 14px', borderBottom: BORDER, fontSize: 13, fontWeight: 700, color: '#1A7A3A' }}>{INR(p.amount_received)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })
          )}

          {/* Signature */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32, paddingTop: 20, borderTop: `1px solid #E5DDD0` }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 36, borderBottom: '1px solid #1A1008', marginBottom: 6 }} />
              <div style={{ fontSize: 11.5, color: MUTED }}>Customer Signature</div>
              <div style={{ fontSize: 12, color: TEXT, marginTop: 2 }}>{customer.full_name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 36, borderBottom: '1px solid #1A1008', marginBottom: 6 }} />
              <div style={{ fontSize: 11.5, color: MUTED }}>Authorised Signatory</div>
              <div style={{ fontSize: 12, color: TEXT, marginTop: 2 }}>{tenant?.shop_name}</div>
            </div>
          </div>

        </div>
        <div style={{ background: '#FBF8F0', padding: '10px 44px', borderTop: BORDER, display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: MUTED }}>
          <span>This is a computer-generated statement. No signature required for digital records.</span>
          <span style={{ color: GOLD, fontWeight: 600 }}>SuvarnSetu · comedgelabs.com</span>
        </div>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${GOLD}, #E8C566, ${GOLD})` }} />
      </div>
    </>
  )
}
