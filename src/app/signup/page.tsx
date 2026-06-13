'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', color: TEXT }
const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep]     = useState<'form' | 'success'>('form')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form, setForm]     = useState({
    shop_name: '', owner_name: '', mobile: '', email: '', password: '', confirm: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters'); return }
    setSaving(true); setError('')

    const res  = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_name:  form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        mobile:     form.mobile.trim(),
        email:      form.email.trim().toLowerCase(),
        password:   form.password,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    setStep('success')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: GOLD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 12 }}>◆</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400, color: TEXT }}>SuvarnSetu</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4, letterSpacing: '0.05em' }}>GOLD SCHEME MANAGEMENT</div>
        </div>

        {step === 'success' ? (
          <div style={{ background: '#fff', borderRadius: 16, border: BORDER, padding: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: TEXT, marginBottom: 12 }}>
              Account Created!
            </h2>
            <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.7, marginBottom: 24 }}>
              Your 30-day free trial has started.<br />
              Login with your email and password to get started.
            </p>
            <button onClick={() => router.push('/login')}
              style={{ background: GOLD, color: '#fff', border: 'none', padding: '12px 32px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' }}>
              Login to SuvarnSetu →
            </button>
            <div style={{ marginTop: 16, fontSize: 12.5, color: MUTED }}>
              Need help? WhatsApp us at <strong>+91 95811 73078</strong>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, border: BORDER, padding: 36 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: TEXT, marginBottom: 4 }}>
              Start Free Trial
            </h2>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>
              30 days free · No credit card · Setup in 5 minutes
            </p>

            {error && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#C03030' }}>
                ⚠ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Lbl t="Shop Name" />
                <input style={inp} required placeholder="e.g. Unique Jewellers" value={form.shop_name}
                  onChange={e => setForm({ ...form, shop_name: e.target.value })} />
              </div>
              <div>
                <Lbl t="Owner Name" />
                <input style={inp} required placeholder="e.g. Ramesh Shah" value={form.owner_name}
                  onChange={e => setForm({ ...form, owner_name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Lbl t="Mobile Number" />
                  <input style={inp} required type="tel" placeholder="10-digit mobile" value={form.mobile}
                    onChange={e => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div>
                  <Lbl t="Email Address" />
                  <input style={inp} required type="email" placeholder="your@email.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Lbl t="Password" />
                  <input style={inp} required type="password" placeholder="Min 6 characters" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <Lbl t="Confirm Password" />
                  <input style={inp} required type="password" placeholder="Repeat password" value={form.confirm}
                    onChange={e => setForm({ ...form, confirm: e.target.value })} />
                </div>
              </div>

              {/* What's included */}
              <div style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '12px 16px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Your trial includes</div>
                {['Customer & enrollment management', 'Daily dues & payment tracking', 'Full reports & dashboard', 'CRM — birthday & anniversary wishes', 'Follow-up remarks for overdue accounts'].map(f => (
                  <div key={f} style={{ fontSize: 12.5, color: TEXT, marginBottom: 4 }}>✓ {f}</div>
                ))}
              </div>

              <button type="submit" disabled={saving}
                style={{ background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '13px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14.5 }}>
                {saving ? 'Creating your account...' : 'Start Free Trial →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 13, color: MUTED }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: GOLD, fontWeight: 600, textDecoration: 'none' }}>Login</Link>
              </div>
            </form>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: MUTED }}>
          Powered by <strong>ComedgeLabs</strong> · comedgelabs@gmail.com · +91 95811 73078
        </div>
      </div>
    </div>
  )
}
