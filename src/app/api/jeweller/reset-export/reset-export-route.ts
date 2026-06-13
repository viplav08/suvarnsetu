import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenantId = user.app_metadata?.tenant_id
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    // Revoke export permission — one-time use
    const admin = createAdminClient()
    const { error } = await admin
      .from('tenants')
      .update({ allow_data_export: false })
      .eq('id', tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
