import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const role = user.app_metadata?.role
      if (role === 'super_admin') redirect('/admin')
      redirect('/dashboard')
    }
  } catch {}
  redirect('/login')
}
