import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import DailyDuesClient  from './DailyDuesClient'

export const dynamic = 'force-dynamic'

const dateStr = (d: any) => !d ? '' : String(d).substring(0, 10)

export default async function DailyDuesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id

  const [{ data: enrollments }, { data: payments }, { data: customers }] = await Promise.all([
    supabase.from('enrollments').select('id,enrollment_id,customer_id,monthly_amount,signup_date,due_day,scheme_duration_months,status,passbook_token,assigned_employee_id').eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('payments').select('enrollment_id,customer_id,months_paid_for,payment_date').eq('tenant_id', tenantId),
    supabase.from('customers').select('id,customer_id,full_name,mobile,whatsapp').eq('tenant_id', tenantId),
  ])

  const today = new Date(); today.setHours(0,0,0,0)

  const customerMap: Record<string, any> = {}
  for (const c of (customers ?? [])) customerMap[c.id] = c

  function countDueDates(signupDate: string, upTo: Date): Date[] {
    const signup = new Date(signupDate + 'T00:00:00')
    const dueDay = signup.getDate()
    const dates: Date[] = []; let cur = new Date(signup)
    while (cur <= upTo) { dates.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth()+1, dueDay) }
    return dates
  }

  function getPaidMonths(enrollment: any): number {
    return (payments ?? [])
      .filter((p:any) => p.enrollment_id ? p.enrollment_id === enrollment.id : p.customer_id === enrollment.customer_id)
      .reduce((s:number, p:any) => s + (p.months_paid_for || 1), 0)
  }

  const dueToday:    any[] = []
  const overdueList: any[] = []
  const renewingSoon: any[] = []

  for (const e of (enrollments ?? [])) {
    const customer = customerMap[e.customer_id]
    if (!customer) continue

    const dueDates  = countDueDates(e.signup_date, today)
    const paid      = getPaidMonths(e)
    const pending   = Math.max(0, dueDates.length - paid)
    const pastDates = dueDates.filter(d => d < today)
    const overdueMo = Math.max(0, pastDates.length - paid)
    const dueDay    = new Date(e.signup_date + 'T00:00:00').getDate()

    if (pending > 0 && dueDay === today.getDate()) {
      dueToday.push({ customer, enrollment: e, pendingAmount: e.monthly_amount, pendingMonths: pending })
    }

    if (overdueMo > 0) {
      const oldestUnpaid = pastDates[paid] ?? pastDates[0]
      const daysOverdue  = oldestUnpaid ? Math.floor((today.getTime() - oldestUnpaid.getTime()) / 86400000) : 0
      overdueList.push({ customer, enrollment: e, overdueMonths: overdueMo, daysOverdue, pendingAmount: overdueMo * e.monthly_amount })
    }

    // Renewal: scheme completing within 45 days
    const duration    = e.scheme_duration_months || 11
    const signup      = new Date(e.signup_date + 'T00:00:00')
    const completesOn = new Date(signup.getFullYear(), signup.getMonth() + (duration - 1), signup.getDate())
    const daysLeft    = Math.ceil((completesOn.getTime() - today.getTime()) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 45) {
      renewingSoon.push({ customer, enrollment: e, completesOn: dateStr(completesOn.toISOString()), daysLeft })
    }
  }

  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue)
  renewingSoon.sort((a, b) => a.daysLeft - b.daysLeft)

  return (
    <DailyDuesClient
      dueToday={dueToday}
      overdue={overdueList}
      renewingSoon={renewingSoon}
      tenantId={tenantId}
    />
  )
}
