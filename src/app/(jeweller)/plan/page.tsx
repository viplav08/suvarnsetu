import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    id: 'starter', label: 'Starter', price: '₹599', annual: '₹5,999',
    color: '#1A5FB4', bg: '#EEF6FF', border: '1px solid #93C5FD',
    features: ['Up to 100 active enrollments', '1 manager login', 'Dashboard & Daily Dues', 'Payments & Gold Rate tracking', 'Follow-up remarks for overdue', 'Closure certificates (PDF)', 'Email support'],
    notIncluded: ['Full Reports', 'CRM — Birthday wishes', 'Data Export', 'Multi-branch'],
  },
  {
    id: 'growth', label: 'Growth', price: '₹1,299', annual: '₹12,999',
    color: '#1A7A3A', bg: '#F0FFF4', border: '1px solid #6EC68A',
    popular: true,
    features: ['Up to 300 active enrollments', '3 manager logins', 'Everything in Starter', 'Full Reports & Monthly Forecast', 'CRM — Birthday & Anniversary wishes', 'Data Export (CSV)', 'Closure certificates (PDF)', 'Phone + Email support'],
    notIncluded: ['Multi-branch'],
  },
  {
    id: 'professional', label: 'Professional', price: '₹2,499', annual: '₹24,999',
    color: '#5030A0', bg: '#F5F0FF', border: '1px solid #C4B5FD',
    features: ['Unlimited active enrollments', '10 manager logins', 'Everything in Growth', 'Multi-branch support', 'Dedicated account manager', 'Priority support', 'WhatsApp integration included'],
    notIncluded: [],
  },
]

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

export default async function PlanPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  const { data: tenant } = await supabase.from('tenants').select('plan, trial_ends_at, shop_name').eq('id', tenantId).single()

  const currentPlan = tenant?.plan ?? 'trial'

  function calDaysLeft(d: string | null): number | null {
    if (!d) return null
    const end = new Date(d); end.setHours(23,59,59,999)
    const today = new Date(); today.setHours(0,0,0,0)
    return Math.ceil((end.getTime() - today.getTime()) / 86400000)
  }
  const trialDays = calDaysLeft(tenant?.trial_ends_at ?? null)

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>
          Choose Your Plan
        </h1>
        {currentPlan === 'trial' && trialDays !== null && trialDays > 0 && (
          <div style={{ marginTop: 8, display: 'inline-block', background: '#FEF9E0', border: '1px solid #FDE68A', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#856404', fontWeight: 600 }}>
            🎯 Trial ends in {trialDays} day{trialDays !== 1 ? 's' : ''} — upgrade to keep your data
          </div>
        )}
        {currentPlan !== 'trial' && (
          <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>
            You are on the <strong style={{ color: TEXT }}>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 32 }}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          return (
            <div key={plan.id} style={{ background: '#fff', borderRadius: 14, border: isCurrent ? `2px solid ${plan.color}` : BORDER, padding: '28px 24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                  MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: plan.bg, color: plan.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, border: plan.border }}>
                  CURRENT
                </div>
              )}
              <div style={{ marginBottom: 20, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{plan.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 32, fontWeight: 400, color: TEXT }}>{plan.price}</span>
                  <span style={{ fontSize: 13, color: MUTED }}>/month</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED }}>{plan.annual}/year <span style={{ color: '#1A7A3A', fontWeight: 600 }}>· Save 2 months</span></div>
              </div>

              <div style={{ marginBottom: 20, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 13, color: TEXT }}>
                    <span style={{ color: plan.color, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                  </div>
                ))}
                {plan.notIncluded.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 13, color: MUTED }}>
                    <span style={{ flexShrink: 0 }}>✗</span>{f}
                  </div>
                ))}
              </div>

              <a href={`https://wa.me/919581173078?text=I want to upgrade to ${plan.label} plan — ${tenant?.shop_name ?? ''}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', background: isCurrent ? '#F5F5F5' : plan.color, color: isCurrent ? MUTED : '#fff', textDecoration: 'none', padding: '11px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: isCurrent ? 'default' : 'pointer' }}>
                {isCurrent ? 'Current Plan' : `Upgrade to ${plan.label} →`}
              </a>
            </div>
          )
        })}
      </div>

      {/* WhatsApp add-on */}
      <div style={{ background: '#fff', borderRadius: 14, border: BORDER, padding: 24, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>📱 WhatsApp Integration Add-on</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            Automated payment reminders, receipts, birthday wishes and overdue alerts.<br />
            Requires an AiSensy account (billed separately by AiSensy).
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>Available on all plans</div>
          <a href="https://wa.me/919581173078?text=I want to set up WhatsApp integration for SuvarnSetu"
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#25D366', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
            Setup WhatsApp →
          </a>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: MUTED }}>
        Questions? Contact us: <strong>+91 95811 73078</strong> · <strong>comedgelabs@gmail.com</strong>
      </div>
    </div>
  )
}
