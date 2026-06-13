import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { shop_name, owner_name, email, mobile, password, license_days, plan } = await req.json()
    if (!shop_name || !email || !password) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const supabase  = createAdminClient()
    const days      = parseInt(license_days ?? '365')
    const expiry    = new Date(); expiry.setDate(expiry.getDate() + days)

    const { data: tenant, error: tenantError } = await supabase.from('tenants').insert({
      shop_name, owner_name, email, mobile: mobile || null, is_active: true,
      license_days: days, license_expires_at: expiry.toISOString(),
      scheme_name: 'Gold Saving Scheme', scheme_duration: 11,
      bonus_type: 'one_month', bonus_value: 1, allow_bonus_toggle: true,
      allow_data_export: false,
      plan: plan ?? 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select().single()

    if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 500 })

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role: 'jeweller_admin', tenant_id: tenant.id },
    })

    if (authError) {
      await supabase.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tenant_id: tenant.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, ...rest } = body
    if (!tenant_id) return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 })

    // Allow updating: is_active, allow_data_export
    const allowed   = ['is_active', 'allow_data_export', 'plan']
    const updateData: Record<string, any> = {}
    for (const key of allowed) {
      if (rest[key] !== undefined) updateData[key] = rest[key]
    }

    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const supabase      = createAdminClient()
    const { error } = await supabase.from('tenants').update(updateData).eq('id', tenant_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
