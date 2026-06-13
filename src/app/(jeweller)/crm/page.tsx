import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CRMClient from './CRMClient'
import UpgradePrompt from '@/components/UpgradePrompt'

export const dynamic = 'force-dynamic'

const PLAN_HAS_CRM = ['trial', 'growth', 'professional']

export default async function CRMPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, shop_name, mobile')
    .eq('id', tenantId)
    .single()

  const plan = tenant?.plan ?? 'trial'

  if (!PLAN_HAS_CRM.includes(plan)) {
    return (
      <UpgradePrompt
        feature="crm"
        title="Unlock CRM & Birthday Wishes"
        description="Track birthdays, anniversaries and send WhatsApp wishes to your customers automatically."
        requiredPlan="Growth"
      />
    )
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('*, enrollments(id, enrollment_id, monthly_amount, signup_date, status)')
    .eq('tenant_id', tenantId)
    .order('full_name')

  return (
    <CRMClient
      customers={customers ?? []}
      shopName={tenant?.shop_name ?? ''}
      shopMobile={tenant?.mobile ?? ''}
    />
  )
}
