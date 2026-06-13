import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const INR = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')
const FD  = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

export default async function PassbookPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient()

  // Fetch enrollment by token
  const { data: enrollment } = await admin
    .from('enrollments')
    .select('*, customers(full_name, mobile, customer_id), tenants(shop_name, mobile, address, city, logo_url)')
    .eq('passbook_token', params.token)
    .single()

  if (!enrollment) notFound()

  const customer = enrollment.customers as any
  const tenant   = enrollment.tenants  as any

  // Fetch payments for this enrollment
  const { data: payments } = await admin
    .from('payments')
    .select('*')
    .eq('enrollment_id', enrollment.id)
    .order('payment_date', { ascending: true })

  const totalPaid     = (payments ?? []).reduce((s, p) => s + p.amount_received, 0)
  const monthsPaid    = (payments ?? []).reduce((s, p) => s + (p.months_paid_for || 1), 0)
  const duration      = enrollment.scheme_duration_months || 11
  const remaining     = Math.max(0, duration - monthsPaid)
  const pct           = Math.min(100, Math.round((monthsPaid / duration) * 100))
  const isComplete    = enrollment.status === 'completed'
  const isCancelled   = enrollment.status === 'cancelled'

  const signup   = new Date(enrollment.signup_date + 'T00:00:00')
  const maturity = new Date(signup.getFullYear(), signup.getMonth() + duration, signup.getDate())

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E6', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{ background: '#1B1108', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>◆</div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 400 }}>{tenant?.shop_name}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gold Savings Scheme</div>
          </div>
        </div>
        {tenant?.mobile && (
          <a href={`tel:${tenant.mobile}`} style={{ color: GOLD, fontSize: 12, textDecoration: 'none' }}>📞 {tenant.mobile}</a>
        )}
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>

        {/* Customer card */}
        <div style={{ background: '#fff', borderRadius: 14, border: BORDER, padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Account Holder</div>
          <div style={{ fontSize: 24, fontWeight: 400, color: TEXT, marginBottom: 4 }}>{customer?.full_name}</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: MUTED }}>
            <span>{customer?.customer_id}</span>
            <span>{customer?.mobile}</span>
          </div>
        </div>

        {/* Scheme status card */}
        <div style={{ background: '#fff', borderRadius: 14, border: BORDER, padding: '22px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Enrollment ID</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{enrollment.enrollment_id}</div>
            </div>
            <div style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
              background: isComplete ? '#F0FFF4' : isCancelled ? '#FEE2E2' : '#FBF8F0',
              color: isComplete ? '#1A7A3A' : isCancelled ? '#C03030' : GOLD,
              border: `1px solid ${isComplete ? '#6EC68A' : isCancelled ? '#FECACA' : GOLD+'55'}` }}>
              {isComplete ? '✓ Completed' : isCancelled ? 'Cancelled' : 'Active'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 20, fontSize: 13.5 }}>
            {[
              ['Monthly Amount', INR(enrollment.monthly_amount)],
              ['Start Date',     FD(enrollment.signup_date)],
              ['Duration',       `${duration} months`],
              ['Maturity Date',  FD(maturity.toISOString().split('T')[0])],
            ].map(([k,v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
                <div style={{ fontWeight: 500, color: TEXT }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginBottom: 6 }}>
              <span>{monthsPaid} of {duration} months paid</span>
              <span style={{ fontWeight: 700, color: pct === 100 ? '#1A7A3A' : GOLD }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: '#F0EAE0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#1A7A3A' : GOLD, borderRadius: 10, transition: 'width 0.5s ease' }} />
            </div>
            {remaining > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>{remaining} month{remaining > 1 ? 's' : ''} remaining · {INR(remaining * enrollment.monthly_amount)} to go</div>
            )}
          </div>
        </div>

        {/* Summary totals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Deposited', value: INR(totalPaid), color: GOLD },
            { label: 'Expected at Maturity', value: INR(duration * enrollment.monthly_amount + enrollment.monthly_amount), color: '#1A7A3A', sub: 'incl. bonus' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 400, color: c.color }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* Payment history */}
        <div style={{ background: '#fff', borderRadius: 14, border: BORDER, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: BORDER }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Payment History</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{(payments ?? []).length} payment{(payments?.length ?? 0) !== 1 ? 's' : ''} recorded</div>
          </div>
          {(payments ?? []).length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: MUTED, fontSize: 13 }}>No payments recorded yet.</div>
          ) : (
            [...(payments ?? [])].reverse().map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < (payments?.length ?? 0) - 1 ? '1px solid #F5F0E6' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: TEXT }}>{FD(p.payment_date)}</div>
                  <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                    {p.months_paid_for > 1 ? `${p.months_paid_for} months · ` : ''}{(p.payment_mode || 'cash').replace('_', ' ')}
                    {p.payment_id && <span style={{ marginLeft: 8, opacity: 0.6 }}>{p.payment_id}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A7A3A' }}>+{INR(p.amount_received)}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: MUTED, lineHeight: 1.8 }}>
          {tenant?.address && <div>{tenant.address}{tenant.city ? `, ${tenant.city}` : ''}</div>}
          This is a digital passbook. For queries contact {tenant?.shop_name}.<br />
          <span style={{ color: GOLD, fontWeight: 600 }}>Powered by SuvarnSetu · comedgelabs.com</span>
        </div>

      </div>
    </div>
  )
}
