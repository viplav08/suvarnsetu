import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { shop_name, owner_name, email, mobile, password } = await req.json()

    if (!shop_name || !owner_name || !email || !mobile || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if email already exists
    const { data: existing } = await admin
      .from('tenants')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Please login.' }, { status: 409 })
    }

    // Create tenant
    // Generate a unique shop_id from shop name + timestamp
    const shop_id = shop_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) + '_' + Date.now().toString(36)
    const trialEndsAt = new Date(Date.now() + 30 * 86400000).toISOString()
    const { data: tenant, error: tenantErr } = await admin.from('tenants').insert({
      shop_name,
      owner_name,
      shop_id,
      email,
      mobile,
      is_active:          true,
      plan:               'trial',
      trial_ends_at:      trialEndsAt,
      // license_expires_at = same as trial — after 30 days app locks unless upgraded
      license_expires_at: trialEndsAt,
      license_end:        trialEndsAt.split('T')[0],
      license_days:       365,
      scheme_name:        'Gold Saving Scheme',
      scheme_duration:    11,
      bonus_type:         'one_month',
      bonus_value:        1,
      allow_bonus_toggle: true,
      allow_data_export:  false,
    }).select().single()

    if (tenantErr) {
      return NextResponse.json({ error: tenantErr.message }, { status: 500 })
    }

    // Create auth user
    const { error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'jeweller_admin', tenant_id: tenant.id },
      user_metadata: { shop_name, owner_name },
    })

    if (authErr) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
