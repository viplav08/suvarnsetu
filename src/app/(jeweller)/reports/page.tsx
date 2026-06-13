import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsPage from './ReportsPage'
import UpgradePrompt from '@/components/UpgradePrompt'

export const dynamic = 'force-dynamic'

const PLAN_HAS_REPORTS = ['trial', 'growth', 'professional']
export default async function Page() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', tenantId).single()
  const plan = tenant?.plan ?? 'trial'

  if (!PLAN_HAS_REPORTS.includes(plan)) {
    return (
      <UpgradePrompt
        feature="reports"
        title="Unlock Full Reports"
        description="Monthly forecast, overdue analysis, payment history and collection trends — all in one place."
        requiredPlan="Growth"
      />
    )
  }

  return <ReportsPage plan={plan} />
}
