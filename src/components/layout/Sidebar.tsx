'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/layout/LogoutButton'

// ── Plan utilities inlined — no external import needed ──────────────────
type Plan = 'trial' | 'starter' | 'growth' | 'professional'

const PLAN_LIMITS: Record<Plan, { label: string }> = {
  trial:        { label: 'Free Trial' },
  starter:      { label: 'Starter' },
  growth:       { label: 'Growth' },
  professional: { label: 'Professional' },
}

const PLAN_FEATURES: Record<string, Plan[]> = {
  reports:  ['trial', 'growth', 'professional'],
  crm:      ['trial', 'growth', 'professional'],
}

function canAccess(feature: string, plan: Plan): boolean {
  return PLAN_FEATURES[feature]?.includes(plan) ?? true
}

function planLabel(plan: Plan): string {
  return PLAN_LIMITS[plan]?.label ?? 'Trial'
}

const PLAN_COLORS: Record<Plan, { bg: string; color: string }> = {
  trial:        { bg: 'rgba(192,148,40,0.15)', color: '#C09428' },
  starter:      { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' },
  growth:       { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E' },
  professional: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
}
// ────────────────────────────────────────────────────────────────────────

const ALL_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  feature: null,      roles: ['jeweller_admin'],           icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/customers',  label: 'Customers',  feature: null,      roles: ['jeweller_admin','manager'], icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/crm',        label: 'CRM',        feature: 'crm',     roles: ['jeweller_admin','manager'], icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { href: '/daily-dues', label: 'Daily Dues', feature: null,      roles: ['jeweller_admin','manager'], icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/payments',   label: 'Payments',   feature: null,      roles: ['jeweller_admin','manager'], icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { href: '/gold-ledger', label: 'Gold Ledger', feature: null, roles: ['jeweller_admin'],           icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/gold-rate',  label: 'Gold Rate',  feature: null,      roles: ['jeweller_admin','manager'], icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/closures',   label: 'Closures',   feature: null,      roles: ['jeweller_admin'],           icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/reports',    label: 'Reports',    feature: 'reports', roles: ['jeweller_admin'],           icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/employees',  label: 'Employees',  feature: null,      roles: ['jeweller_admin'],           icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/plan',        label: 'My Plan',    feature: null,      roles: ['jeweller_admin'],           icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { href: '/settings',   label: 'Settings',   feature: null,      roles: ['jeweller_admin'],           icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function Sidebar({ role, plan = 'trial' }: { role: string; plan?: string }) {
  const pathname   = usePathname()
  const isManager  = role === 'manager'
  const safePlan   = (plan as Plan) in PLAN_LIMITS ? (plan as Plan) : 'trial'
  const planColors = PLAN_COLORS[safePlan]
  const nav        = ALL_NAV.filter(item => item.roles.includes(role))

  return (
    <aside style={{ width: 230, minHeight: '100vh', background: '#1B1108', display: 'flex', flexDirection: 'column', padding: '24px 14px', flexShrink: 0 }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '0 6px' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#C09428', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>◆</div>
        <div>
          <div style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 400 }}>SuvarnSetu</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {isManager ? 'Manager' : 'Gold Schemes'}
          </div>
        </div>
      </div>

      {/* Plan badge */}
      <div style={{ marginBottom: 16, padding: '6px 12px', background: planColors.bg, border: `1px solid ${planColors.color}44`, borderRadius: 8, fontSize: 11, color: planColors.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
        <span>{isManager ? '👤 Manager' : `${planLabel(safePlan)} Plan`}</span>
        {safePlan === 'trial' && <span style={{ fontSize: 9, opacity: 0.8 }}>TRIAL</span>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(item => {
          const locked = item.feature ? !canAccess(item.feature, safePlan) : false
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', color: active ? '#fff' : locked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)', textDecoration: 'none', padding: '9px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: active ? 600 : 400, background: active ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </div>
              {locked && <span style={{ fontSize: 10 }}>🔒</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
        <LogoutButton variant="sidebar" />
        <div style={{ marginTop: 10, padding: '0 12px', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          Developed by<br />
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>comedgelabs.com</span>
        </div>
      </div>
    </aside>
  )
}
