import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = user.app_metadata?.role
  if (role === 'super_admin') redirect('/admin')
  redirect('/dashboard')
}