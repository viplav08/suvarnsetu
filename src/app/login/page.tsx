'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          background: #F5F0E6;
        }
        .login-left {
          flex: 1;
          background: #1B1108;
          display: flex;
          flex-direction: column;
          padding: 48px;
          position: relative;
          overflow: hidden;
        }
        .login-right {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: #F5F0E6;
        }
        @media (max-width: 768px) {
          .login-left  { display: none; }
          .login-right {
            width: 100%;
            padding: 32px 24px;
            align-items: flex-start;
            padding-top: 60px;
          }
        }
      `}</style>

      <div className="login-shell">

        {/* Left panel — desktop only */}
        <div className="login-left">
          <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, background: 'radial-gradient(circle, rgba(192,148,40,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #D4A832, #A07820)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22, fontSize: 28 }}>◆</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: '#fff', marginBottom: 10, letterSpacing: '0.02em' }}>SuvarnSetu</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 40 }}>Gold Scheme Management</div>
            {['Track every instalment accurately', 'Know who is due today — instantly', 'WhatsApp receipts & reminders', 'Birthday wishes on auto-pilot'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, textAlign: 'left' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(192,148,40,0.2)', border: '1px solid rgba(192,148,40,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C09428' }} />
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Developed by ComedgeLabs · suvarnsetu.com
          </div>
        </div>

        {/* Right panel — form */}
        <div className="login-right">
          <div style={{ width: '100%', maxWidth: 380 }}>

            {/* Mobile logo */}
            <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C09428', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', flexShrink: 0 }}>◆</div>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 400, color: '#1A1008' }}>SuvarnSetu</div>
                <div style={{ fontSize: 11, color: '#7A6A5A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gold Schemes</div>
              </div>
            </div>

            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: '#1A1008', marginBottom: 6 }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: '#7A6A5A', marginBottom: 28 }}>Sign in to your account</p>

            {error && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#C03030' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#7A6A5A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #E5DDD0', borderRadius: 10, padding: '13px 14px', fontSize: 15, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1A1008' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#7A6A5A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password</label>
                <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #E5DDD0', borderRadius: 10, padding: '13px 14px', fontSize: 15, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: '100%', background: loading ? '#C0942880' : '#C09428', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #E5DDD0' }}>
              <span style={{ fontSize: 13.5, color: '#7A6A5A' }}>New to SuvarnSetu? </span>
              <Link href="/signup" style={{ fontSize: 13.5, color: '#C09428', fontWeight: 700, textDecoration: 'none' }}>Start Free 30-Day Trial →</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
