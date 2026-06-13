import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DailyDuesClient from './DailyDuesClient'

export default async function DailyDuesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  const today = new Date()

  const [{ data: customers }, { data: payments }] = await Promise.all([
    supabase.from('customers').select('*').eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('payments').select('*').eq('tenant_id', tenantId),
  ])

  const dueInfoList = (customers ?? []).map((c: any) => {
    const signup = new Date(c.signup_date + 'T00:00:00')
    const dueDay = signup.getDate()
    const dueDates: Date[] = []
    let cursor = new Date(signup)
    while (cursor <= today) {
      dueDates.push(new Date(cursor))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dueDay)
    }
    const totalPaid = (payments ?? [])
      .filter((p: any) => p.customer_id === c.id)
      .reduce((s: number, p: any) => s + (p.months_paid_for || 1), 0)
    const pending = Math.max(0, dueDates.length - totalPaid)
    const pastDates = dueDates.filter(d => d < today)
    const overdueMonths = Math.max(0, pastDates.length - totalPaid)
    return {
      customer: c, dueDay, pending,
      pendingAmount: pending * c.monthly_amount,
      isDueToday: dueDay === today.getDate() && pending > 0,
      isOverdue: overdueMonths > 0,
      overdueMonths,
    }
  })

  return (
    <DailyDuesClient
      dueToday={dueInfoList.filter(d => d.isDueToday)}
      overdue={dueInfoList.filter(d => d.isOverdue)}
      allCustomers={customers ?? []}
      tenantId={tenantId}
    />
  )
}