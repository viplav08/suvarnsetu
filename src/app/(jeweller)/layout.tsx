import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LayoutShell from './layout-shell'

function trialDaysLeft(t: string | null) {
  if (!t) return null
  const end = new Date(t); end.setHours(23,59,59,999)
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

async function NotificationBar({ tenantId }: { tenantId: string }) {
  const supabase = createClient()
  const today = new Date(); today.setHours(0,0,0,0)
  const [{ data: en }, { data: pa }] = await Promise.all([
    supabase.from('enrollments').select('id,customer_id,monthly_amount,signup_date,enrollment_id').eq('tenant_id', tenantId).eq('status','active'),
    supabase.from('payments').select('enrollment_id,customer_id,months_paid_for').eq('tenant_id', tenantId),
  ])
  let due = 0, over = 0
  for (const e of (en ?? [])) {
    const d = new Date(e.signup_date+'T00:00:00'), day = d.getDate()
    const dates: Date[] = []; let c = new Date(d)
    while (c <= today) { dates.push(new Date(c)); c = new Date(c.getFullYear(),c.getMonth()+1,day) }
    const paid = (pa??[]).filter((p:any)=>p.enrollment_id?p.enrollment_id===e.id:p.customer_id===e.customer_id).reduce((s:number,p:any)=>s+(p.months_paid_for||1),0)
    if (Math.max(0, dates.length - paid) > 0 && day === today.getDate()) due++
    if (Math.max(0, dates.filter((x:Date)=>x<today).length - paid) > 0) over++
  }
  return (
    <div style={{ background:'#fff', borderBottom:'1px solid #E5DDD0', padding:'0 24px', height:44, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:14, flexShrink:0 }}>
      {due > 0 && <a href="/daily-dues" style={{ color:'#856404', background:'#FEF9E0', padding:'4px 10px', borderRadius:16, fontWeight:600, fontSize:12, border:'1px solid #FDE68A', textDecoration:'none' }}>📅 {due} due today</a>}
      {over > 0 && <a href="/daily-dues" style={{ color:'#C03030', background:'#FEE2E2', padding:'4px 10px', borderRadius:16, fontWeight:600, fontSize:12, border:'1px solid #FECACA', textDecoration:'none' }}>⚠ {over} overdue</a>}
      {due === 0 && over === 0 && <span style={{ color:'#1A7A3A', fontSize:12 }}>✓ All accounts current</span>}
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
  const { data: tenant } = await supabase.from('tenants').select('is_active,license_expires_at,plan,trial_ends_at').eq('id', tenantId).single()
  if (tenant?.is_active === false) redirect('/login')
  if (tenant?.license_expires_at && new Date(tenant.license_expires_at) < new Date()) redirect('/license-expired')
  const plan = tenant?.plan ?? 'trial'
  const days = trialDaysLeft(tenant?.trial_ends_at ?? null)
  if (plan === 'trial' && days !== null && days <= 0) redirect('/license-expired')
  const GOLD = '#C09428'
  const trialBanner = (plan === 'trial' && days !== null && days > 0) ? (
    <div data-trial-banner="true" style={{ background:days<=5?'#FEE2E2':days<=10?'#FEF0E0':'#FBF8F0', borderBottom:`1px solid ${days<=5?'#FECACA':days<=10?'#FDBA74':'#E5DDD0'}`, padding:'7px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12.5, color:days<=5?'#C03030':days<=10?'#C05000':'#7A6A5A', flexShrink:0 }}>
      <span>{days<=5?'⚠ ':'🎯 '}<strong>Free Trial</strong> — {days} day{days!==1?'s':''} remaining</span>
      <a href="https://wa.me/919860266617" target="_blank" rel="noopener noreferrer" style={{ background:GOLD, color:'#fff', padding:'3px 12px', borderRadius:6, textDecoration:'none', fontWeight:600, fontSize:11.5 }}>Upgrade</a>
    </div>
  ) : null
  return (
    <LayoutShell role={role ?? 'jeweller_admin'} plan={plan} trialBanner={trialBanner} notificationBar={<NotificationBar tenantId={tenantId} />}>
      {children}
    </LayoutShell>
  )
}
