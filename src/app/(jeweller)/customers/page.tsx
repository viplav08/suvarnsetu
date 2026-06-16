import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id

  const [{ data: customers }, { data: enrollments }, { data: employees }, { data: tenant }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    supabase
      .from('enrollments')
      .select('*, employees(name)')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    supabase
      .from('employees')
      .select('id, name')
      .eq('tenant_id', tenantId),   // removed is_active filter
    supabase
      .from('tenants')
      .select('scheme_duration, scheme_name')
      .eq('id', tenantId)
      .single(),
  ])

  return (
    <CustomersClient
      customers={customers ?? []}
      enrollments={enrollments ?? []}
      employees={employees ?? []}
      tenantId={tenantId}
      schemeDuration={tenant?.scheme_duration ?? 11}
      plan={tenant?.plan ?? 'trial'}
    />
  )
}
