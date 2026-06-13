import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LayoutShell from './layout-shell'

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  // Calendar-based: end of trial day minus start of today
  const end   = new Date(trialEndsAt)
  end.setHours(23, 59, 59, 999)       // count until end of the trial day
  const today = new Date()
  today.setHours(0, 0, 0, 0)          // from start of today
  return Math.ceil((end.getTime() - today.getTime()) / 86400000)
}

async function NotificationBar({ tenantId }: { tenantId: string }) {
  const supabase = createClient()
  const today    = new Date(); today.setHours(0,0,0,0)

  const [{ data: enrollments }, { data: payments }] = await Promise.all([
    supabase.from('enrollments').select('id,customer_id,monthly_amount,signup_date,enrollment_id').eq('tenant_id', tenantId).eq('status','active'),
    supabase.from('payments').select('enrollment_id,customer_id,months_paid_for').eq('tenant_id', tenantId),
  ])

  let dueToday = 0, overdue = 0
  for (const e of (enrollments ?? [])) {
    const signup = new Date(e.signup_date + 'T00:00:00')
    const dueDay = signup.getDate()
    const dates: Date[] = []; let cur = new Date(signup)
    while (cur <= today) { dates.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth()+1, dueDay) }
    const paid    = (payments ?? []).filter((p:any) => p.enrollment_id ? p.enrollment_id === e.id : p.customer_id === e.customer_id).reduce((s:number,p:any) => s+(p.months_paid_for||1), 0)
    const pending = Math.max(0, dates.length - paid)
    if (pending > 0 && dueDay === today.getDate()) dueToday++
    if (Math.max(0, dates.filter((d:Date) => d < today).length - paid) > 0) overdue++
  }

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #E5DDD0', padding: '0 24px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, flexShrink: 0 }}>
      {dueToday > 0 && (
        <a href="/daily-dues" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: '#856404', background: '#FEF9E0', padding: '4px 10px', borderRadius: 16, fontWeight: 600, fontSize: 12, border: '1px solid #FDE68A' }}>
          📅 {dueToday} due today
        </a>
      )}
      {overdue > 0 && (
        <a href="/daily-dues" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: '#C03030', background: '#FEE2E2', padding: '4px 10px', borderRadius: 16, fontWeight: 600, fontSize: 12, border: '1px solid #FECACA' }}>
          ⚠ {overdue} overdue
        </a>
      )}
      {dueToday === 0 && overdue === 0 && (
        <span style={{ color: '#1A7A3A', fontSize: 12 }}>✓ All accounts current</span>
      )}
    </div>
  )
}

export default async function JewellerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role     = user.app_metadata?.role
  const tenantId = user.app_metadata?.tenant_id

  if (role === 'super_admin') redirect('/admin')
  if (!tenantId) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('is_active, license_expires_at, plan, trial_ends_at')
    .eq('id', tenantId)
    .single()

  if (tenant?.is_active === false) redirect('/login')
  if (tenant?.license_expires_at && new Date(tenant.license_expires_at) < new Date()) redirect('/license-expired')

  const plan     = tenant?.plan ?? 'trial'
  const daysLeft = trialDaysLeft(tenant?.trial_ends_at ?? null)
  const expired  = daysLeft !== null && daysLeft <= 0

  if (plan === 'trial' && expired) redirect('/license-expired')

  const GOLD = '#C09428'

  const trialBanner = (plan === 'trial' && daysLeft !== null && daysLeft > 0) ? (
    <div data-trial-banner="true" style={{
      background:   daysLeft <= 5 ? '#FEE2E2' : daysLeft <= 10 ? '#FEF0E0' : '#FBF8F0',
      borderBottom: `1px solid ${daysLeft <= 5 ? '#FECACA' : daysLeft <= 10 ? '#FDBA74' : '#E5DDD0'}`,
      padding: '7px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 12.5, color: daysLeft <= 5 ? '#C03030' : daysLeft <= 10 ? '#C05000' : '#7A6A5A', flexShrink: 0,
    }}>
      <span>{daysLeft <= 5 ? '⚠ ' : '🎯 '}<strong>Free Trial</strong> — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
      <a href="https://wa.me/919581173078?text=I want to subscribe to SuvarnSetu"
        target="_blank" rel="noopener noreferrer"
        style={{ background: GOLD, color: '#fff', padding: '3px 12px', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 11.5 }}>
        Upgrade
      </a>
    </div>
  ) : null

  const notificationBar = <NotificationBar tenantId={tenantId} />

  return (
    <LayoutShell
      role={role ?? 'jeweller_admin'}
      plan={plan}
      trialBanner={trialBanner}
      notificationBar={notificationBar}
    >
      {children}
    </LayoutShell>
  )
}
