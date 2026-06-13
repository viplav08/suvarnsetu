import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    // Verify caller is jeweller_admin
    const supabase      = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const callerRole = user.app_metadata?.role
    const tenantId   = user.app_metadata?.tenant_id

    if (callerRole !== 'jeweller_admin' && callerRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only jeweller admins can create managers' }, { status: 403 })
    }
    if (!tenantId) return NextResponse.json({ error: 'No tenant found' }, { status: 400 })

    const admin = createAdminClient()

    // Create auth user with manager role
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'manager', tenant_id: tenantId },
    })

    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

    // Record in staff table
    const { error: staffErr } = await admin.from('staff').insert({
      tenant_id:    tenantId,
      auth_user_id: authUser.user.id,
      name,
      email,
      role:         'manager',
      is_active:    true,
    })

    if (staffErr) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: staffErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { staff_id, auth_user_id } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'jeweller_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Deactivate in staff table
    await admin.from('staff').update({ is_active: false }).eq('id', staff_id)

    // Disable auth user
    if (auth_user_id) {
      await admin.auth.admin.updateUserById(auth_user_id, {
        app_metadata: { role: 'manager', tenant_id: user.app_metadata?.tenant_id, disabled: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
