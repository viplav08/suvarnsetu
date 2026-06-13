import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id

  const [{ data: payments }, { data: enrollments }] = await Promise.all([
    supabase
      .from('payments')
      .select('*, enrollments(enrollment_id, monthly_amount, customers(full_name, customer_id)), customers(full_name, customer_id)')
      .eq('tenant_id', tenantId)
      .order('payment_date', { ascending: false }),
    supabase
      .from('enrollments')
      .select('*, customers(full_name, customer_id, mobile)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
  ])

  return (
    <PaymentsClient
      payments={payments ?? []}
      enrollments={enrollments ?? []}
      tenantId={tenantId}
    />
  )
}
