import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    id: 'starter', label: 'Starter', price: '₹599', annual: '₹5,999',
    color: '#1A5FB4', bg: '#EEF6FF', border: '1px solid #93C5FD',
    features: ['Up to 100 active enrollments', '1 manager login', 'Dashboard & Daily Dues', 'Payments & Gold Rate tracking', 'Follow-up remarks for overdue', 'Closure certificates (PDF)', 'Email support'],
    notIncluded: ['Full Reports', 'CRM — Birthday wishes', 'Data Export', 'Multi-branch'],
    waAddon: true,
  },
  {
    id: 'growth', label: 'Growth', price: '₹1,299', annual: '₹12,999',
    color: '#1A7A3A', bg: '#F0FFF4', border: '1px solid #6EC68A',
    popular: true,
    features: ['Up to 300 active enrollments', '3 manager logins', 'Everything in Starter', 'Full Reports & Monthly Forecast', 'CRM — Birthday & Anniversary wishes', 'Data Export (CSV)', 'Closure certificates (PDF)', 'Phone + Email support'],
    notIncluded: ['Multi-branch'],
    waAddon: true,
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
              <div style={{ marginBottom: 20 }}>
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

              {(plan as any).waAddon && (
                <div style={{ fontSize: 12, color: '#25D366', background: '#F0FFF4', border: '1px solid #6EC68A', borderRadius: 8, padding: '7px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📱</span> WhatsApp add-on: <strong>₹3,000 setup</strong> + AiSensy fees
                </div>
              )}
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
      <div style={{ background: '#fff', borderRadius: 14, border: BORDER, padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6 }}>📱 WhatsApp Integration Add-on</div>
            <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.7, maxWidth: 540 }}>
              Send automated payment receipts, due reminders, birthday & anniversary wishes, and overdue alerts — directly from your WhatsApp number.
            </div>
          </div>
          <a href="https://wa.me/919860266617?text=I want to set up WhatsApp integration for SuvarnSetu"
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#25D366', color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
            Setup WhatsApp →
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'SuvarnSetu Setup Fee', value: '₹3,000', sub: 'One-time · Paid to ComedgeLabs', color: TEXT },
            { label: 'AiSensy Monthly Fee', value: '₹1,500/mo', sub: 'Paid directly to AiSensy · Billed to you', color: '#C05000' },
            { label: 'WhatsApp Message Charges', value: 'As used', sub: 'Meta charges per conversation · Via AiSensy wallet', color: '#1A5FB4' },
          ].map(item => (
            <div key={item.label} style={{ background: '#F9F7F3', borderRadius: 10, padding: '14px 16px', border: BORDER }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-cormorant), serif', color: item.color, marginBottom: 4 }}>{item.value}</div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#FBF8F0', borderRadius: 8, border: '1px solid #E5DDD0', fontSize: 12.5, color: MUTED, lineHeight: 1.7 }}>
          <strong style={{ color: TEXT }}>How it works:</strong> You get your own AiSensy account (registered under your business). AiSensy charges ₹1,500/month for their platform + Meta charges per WhatsApp conversation (~₹0.35–₹0.58 per conversation). SuvarnSetu connects to your AiSensy account for ₹3,000 one-time setup. <strong style={{ color: TEXT }}>Professional plan includes the ₹3,000 setup fee at no extra cost.</strong>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: MUTED }}>
        Questions? Contact us: <strong>+91 95811 73078</strong> · <strong>comedgelabs@gmail.com</strong>
      </div>
    </div>
  )
}
