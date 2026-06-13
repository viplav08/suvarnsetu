import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuperAdminClient from './SuperAdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'super_admin') redirect('/login')

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, shop_name, owner_name, email, mobile, is_active, license_expires_at, license_days, created_at')
    .order('created_at', { ascending: false })

  return <SuperAdminClient tenants={tenants ?? []} />
}
