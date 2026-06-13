import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages a manager role is permitted to access
const MANAGER_ALLOWED = [
  '/customers',
  '/daily-dues',
  '/payments',
  '/crm',
  '/gold-rate',
]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Not logged in — redirect to login (except public routes)
  if (!user && path !== '/login' && !path.startsWith('/license-expired')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Manager: restrict to allowed pages only
  if (user?.app_metadata?.role === 'manager') {
    const allowed = MANAGER_ALLOWED.some(p => path.startsWith(p))
    if (!allowed && path !== '/login') {
      return NextResponse.redirect(new URL('/daily-dues', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)',],
}
