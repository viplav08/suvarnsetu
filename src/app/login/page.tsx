'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setLoading(false); setError('Invalid email or password. Please try again.'); return }
    const role = data.user?.app_metadata?.role
    if (role === 'super_admin') router.push('/admin')
    else router.push('/dashboard')
  }

  // Subtle gold crosshatch pattern on dark background
  const crosshatchBg = {
    background: '#1B1108',
    backgroundImage: [
      // Horizontal lines
      `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(192,148,40,0.07) 39px, rgba(192,148,40,0.07) 40px)`,
      // Vertical lines
      `repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(192,148,40,0.07) 39px, rgba(192,148,40,0.07) 40px)`,
      // Diagonal lines /
      `repeating-linear-gradient(45deg, transparent, transparent 27px, rgba(192,148,40,0.04) 27px, rgba(192,148,40,0.04) 28px)`,
      // Diagonal lines \
      `repeating-linear-gradient(135deg, transparent, transparent 27px, rgba(192,148,40,0.04) 27px, rgba(192,148,40,0.04) 28px)`,
    ].join(', '),
  }

  const features = [
    'Manage gold saving schemes',
    'Track monthly dues & payments',
    'Account closures with PDF reports',
    'CRM with birthday & anniversary alerts',
    'Multi-branch license management',
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: 1,
        ...crosshatchBg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Radial glow behind logo */}
        <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(192,148,40,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Main content — vertically centered */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 48px 80px', textAlign: 'center' }}>

          {/* Logo */}
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #D4A832, #A07820)', boxShadow: '0 4px 24px rgba(192,148,40,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, fontSize: 28 }}>
            ◆
          </div>

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 400, color: '#fff', marginBottom: 10, letterSpacing: 0.5 }}>
            SuvarnSetu
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14.5, lineHeight: 1.7, marginBottom: 36, maxWidth: 300 }}>
            Gold jewellery subscription management<br />built for Indian jewellers.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left', width: '100%', maxWidth: 300 }}>
            {features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(192,148,40,0.2)', border: '1px solid rgba(192,148,40,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#C09428', fontSize: 10, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — pinned to bottom, never overlaps content */}
        <div style={{ padding: '20px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>Developed by</div>
          <a href="https://comedgelabs.com" target="_blank" rel="noopener noreferrer"
            style={{ color: '#C09428', textDecoration: 'none', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>
            ComedgeLabs
          </a>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <a href="mailto:comedgelabs@gmail.com" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>comedgelabs@gmail.com</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
            <a href="tel:+919581173078" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>+91 95811 73078</a>
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div style={{ width: 480, background: '#F5F0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: '#1A1008', marginBottom: 6 }}>
            Welcome back
          </h2>
          <p style={{ color: '#7A6A5A', fontSize: 14, marginBottom: 36 }}>Sign in to your account</p>

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#C03030', fontWeight: 500 }}>
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6A5A', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="your@email.com"
                style={{ width: '100%', border: '1.5px solid #E5DDD0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box', transition: 'border-color .15s', fontFamily: 'inherit' }}
                onFocus={e => e.currentTarget.style.borderColor = '#C09428'}
                onBlur={e  => e.currentTarget.style.borderColor = '#E5DDD0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6A5A', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Password
              </label>
              <input
                type="password" required value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                style={{ width: '100%', border: '1.5px solid #E5DDD0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }}
                onFocus={e => e.currentTarget.style.borderColor = '#C09428'}
                onBlur={e  => e.currentTarget.style.borderColor = '#E5DDD0'}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{ width: '100%', background: loading ? '#C0942880' : '#C09428', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, letterSpacing: '0.03em', transition: 'background .15s' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>

          {/* Signup link */}
          <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #E5DDD0' }}>
            <span style={{ fontSize: 13.5, color: '#7A6A5A' }}>New to SuvarnSetu? </span>
            <a href="/signup" style={{ fontSize: 13.5, color: '#C09428', fontWeight: 700, textDecoration: 'none' }}>
              Start Free 30-Day Trial →
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
