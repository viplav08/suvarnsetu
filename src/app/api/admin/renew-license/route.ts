import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { tenant_id, days_to_add } = await req.json()
    if (!tenant_id || !days_to_add) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createAdminClient()

    // Fetch current expiry
    const { data: tenant } = await supabase
      .from('tenants').select('license_expires_at').eq('id', tenant_id).single()

    // If already expired or no expiry, start from today; otherwise extend from current expiry
    const base = tenant?.license_expires_at && new Date(tenant.license_expires_at) > new Date()
      ? new Date(tenant.license_expires_at)
      : new Date()

    const newExpiry = new Date(base)
    newExpiry.setDate(newExpiry.getDate() + parseInt(days_to_add))

    const { error } = await supabase.from('tenants').update({
      license_expires_at: newExpiry.toISOString(),
      license_days:       parseInt(days_to_add),
      is_active:          true,
    }).eq('id', tenant_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, new_expiry: newExpiry.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
