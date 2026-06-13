'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

function daysRemaining(exp: string | null) {
  if (!exp) return null
  return Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)
}

function DaysBadge({ exp }: { exp: string | null }) {
  if (!exp) return <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>Not set</span>
  const d = daysRemaining(exp)!
  const [bg, color] = d <= 0 ? ['#FEE2E2','#C03030'] : d <= 15 ? ['#FEF0E0','#C05000'] : d <= 30 ? ['#FEF9E0','#856404'] : ['#F0FFF4','#1A7A3A']
  return <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: bg, color }}>{d <= 0 ? 'Expired' : d + 'd left'}</span>
}

const FD = (d: string) => !d ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function SuperAdminClient({ tenants: init }: { tenants: any[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [tenants,     setTenants]     = useState(init)
  const [loadingDemo, setLoadingDemo] = useState<string|null>(null)

  async function loadDemoData(tenantId: string) {
    if (!confirm('Load sample demo data for this account? This adds realistic customers, payments and gold rates.')) return
    setLoadingDemo(tenantId)
    try {
      const res  = await fetch('/api/admin/load-demo-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId }) })
      const data = await res.json()
      if (data.error) alert('Error: ' + data.error)
      else alert('✓ Demo data loaded! Ask the jeweller to refresh their dashboard.')
    } catch(e: any) { alert('Error: ' + e.message) }
    setLoadingDemo(null)
  }
  const [showAdd, setShowAdd] = useState(false)
  const [renewTarget, setRenewTarget] = useState<any>(null)
  const [renewDays, setRenewDays] = useState('365')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ shop_name: '', owner_name: '', email: '', mobile: '', password: '', license_days: '365', plan: 'trial' })

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/admin/create-jeweller', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert('Error: ' + data.error); return }
    setShowAdd(false)
    setForm({ shop_name: '', owner_name: '', email: '', mobile: '', password: '', license_days: '365' })
    router.refresh()
  }

  async function patch(tenant_id: string, updates: any) {
    const res = await fetch('/api/admin/create-jeweller', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id, ...updates }) })
    return res.json()
  }

  async function toggleActive(id: string, cur: boolean) {
    const data = await patch(id, { is_active: !cur })
    if (data.success) setTenants(prev => prev.map(t => t.id === id ? { ...t, is_active: !cur } : t))
    else alert(data.error)
  }

  async function changePlan(id: string, plan: string) {
    const data = await patch(id, { plan })
    if (data.success) setTenants(prev => prev.map(t => t.id === id ? { ...t, plan } : t))
    else alert(data.error)
  }

  async function toggleExport(id: string, cur: boolean) {
    const data = await patch(id, { allow_data_export: !cur })
    if (data.success) setTenants(prev => prev.map(t => t.id === id ? { ...t, allow_data_export: !cur } : t))
    else alert(data.error)
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/admin/renew-license', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: renewTarget.id, days_to_add: renewDays }) })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert('Error: ' + data.error); return }
    setTenants(prev => prev.map(t => t.id === renewTarget.id ? { ...t, license_expires_at: data.new_expiry, is_active: true } : t))
    setRenewTarget(null)
  }

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  const active   = tenants.filter(t => t.is_active && (daysRemaining(t.license_expires_at) === null || daysRemaining(t.license_expires_at)! > 0)).length
  const expiring = tenants.filter(t => { const d = daysRemaining(t.license_expires_at); return d !== null && d > 0 && d <= 15 }).length
  const expired  = tenants.filter(t => { const d = daysRemaining(t.license_expires_at); return d !== null && d <= 0 }).length
  const exportEnabled = tenants.filter(t => t.allow_data_export).length

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E6' }}>
      {/* Top bar */}
      <div style={{ background: '#1B1108', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>◆</div>
          <span style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: 17 }}>SuvarnSetu</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Super Admin</span>
        </div>
        <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.8)', padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>

      <div style={{ padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: TEXT }}>Jeweller Accounts</h1>
            <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Manage shops, licenses and data export permissions</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: GOLD, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>+ Add Jeweller</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            ['Total Shops',    tenants.length,  TEXT,      '#fff'],
            ['Active',         active,           '#1A7A3A', '#F0FFF4'],
            ['Expiring Soon',  expiring,         '#C05000', '#FEF0E0'],
            ['Expired',        expired,          '#C03030', '#FEE2E2'],
            ['Export Enabled', exportEnabled,    '#1A5FB4', '#EEF6FF'],
          ['On Paid Plans', tenants.filter(t=>t.plan&&t.plan!=='trial').length, '#5030A0', '#F5F0FF'],
          ].map(([l,v,c,bg]: any) => (
            <div key={l} style={{ background: bg, borderRadius: 12, border: BORDER, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{l}</div>
              <div style={{ fontSize: 28, fontFamily: 'Georgia, serif', fontWeight: 400, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Shop', 'Owner', 'Mobile', 'Plan', 'License Expires', 'Days Left', 'Status', 'Data Export', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {tenants.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: MUTED }}>No jeweller accounts yet.</td></tr>
                : tenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{t.shop_name}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{t.email}</div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{t.owner_name}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{t.mobile || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{FD(t.created_at)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13, whiteSpace: 'nowrap' }}>{t.license_expires_at ? FD(t.license_expires_at) : '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><DaysBadge exp={t.license_expires_at} /></td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      {(() => { const pc: Record<string,any> = {trial:{bg:'#FEF9E0',color:'#856404'},starter:{bg:'#EEF6FF',color:'#1A5FB4'},growth:{bg:'#F0FFF4',color:'#1A7A3A'},professional:{bg:'#F5F0FF',color:'#5030A0'}}; const s=pc[t.plan??'trial']??pc.trial; return <span style={{padding:'3px 10px',borderRadius:16,fontSize:11,fontWeight:700,background:s.bg,color:s.color,textTransform:'capitalize'}}>{t.plan??'trial'}</span> })()}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: t.is_active ? '#F0FFF4' : '#F5F5F5', color: t.is_active ? '#1A7A3A' : '#888', border: `1px solid ${t.is_active ? '#6EC68A' : '#ccc'}` }}>{t.is_active ? 'Active' : 'Inactive'}</span>
                    </td>

                    {/* Data export toggle */}
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <button
                        onClick={() => toggleExport(t.id, t.allow_data_export)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: t.allow_data_export ? '#EEF6FF' : '#F5F5F5',
                          color:      t.allow_data_export ? '#1A5FB4' : '#888',
                          transition: 'all .15s',
                        }}>
                        {t.allow_data_export ? '📥 ON' : '🔒 OFF'}
                      </button>
                    </td>

                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setRenewTarget(t); setRenewDays('365') }} style={{ background: GOLD, color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Renew</button>
                        <button onClick={() => toggleActive(t.id, t.is_active)} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>{t.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => loadDemoData(t.id)} disabled={loadingDemo === t.id} style={{ background: 'transparent', border: BORDER, color: '#1A5FB4', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>{loadingDemo === t.id ? '...' : '🎯 Demo'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: MUTED }}>
          SuvarnSetu · Powered by <a href="https://comedgelabs.com" target="_blank" style={{ color: GOLD, textDecoration: 'none' }}>ComedgeLabs</a> · comedgelabs@gmail.com · +91 95811 73078
        </div>
      </div>

      {/* Add Jeweller Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: TEXT }}>New Jeweller Account</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Lbl t="Shop Name" /><input style={inp} required value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} /></div>
                <div><Lbl t="Owner Name" /><input style={inp} required value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} /></div>
                <div><Lbl t="Login Email" /><input style={inp} type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Lbl t="Mobile" /><input style={inp} type="tel" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
                <div><Lbl t="Password" /><input style={inp} type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                <div><Lbl t="Starting Plan" />
                  <select style={inp} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>
                    <option value="trial">Free Trial (30 days)</option>
                    <option value="starter">Starter — ₹599/mo</option>
                    <option value="growth">Growth — ₹1,299/mo</option>
                    <option value="professional">Professional — ₹2,499/mo</option>
                  </select>
                </div>
                <div><Lbl t="License Duration" />
                  <select style={inp} value={form.license_days} onChange={e => setForm({ ...form, license_days: e.target.value })}>
                    <option value="30">30 days — Trial</option>
                    <option value="90">90 days — 3 months</option>
                    <option value="180">180 days — 6 months</option>
                    <option value="365">365 days — 1 year</option>
                    <option value="730">730 days — 2 years</option>
                  </select>
                </div>
              </div>
              <div style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '10px 14px', fontSize: 12.5, color: MUTED }}>
                Expires: <strong style={{ color: TEXT }}>{new Date(Date.now() + parseInt(form.license_days) * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{saving ? 'Creating...' : 'Create Account'}</button>
                <button type="button" onClick={() => setShowAdd(false)} style={{ padding: '11px 20px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Renew License</h2>
              <button onClick={() => setRenewTarget(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <div style={{ background: '#FBF8F0', borderRadius: 8, border: BORDER, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: TEXT }}>{renewTarget.shop_name}</div>
              <div style={{ color: MUTED, marginTop: 2 }}>Current: <strong>{renewTarget.license_expires_at ? FD(renewTarget.license_expires_at) : 'Not set'}</strong></div>
            </div>
            <form onSubmit={handleRenew} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><Lbl t="Extend By" />
                <select style={inp} value={renewDays} onChange={e => setRenewDays(e.target.value)}>
                  <option value="30">30 days</option><option value="90">90 days</option>
                  <option value="180">180 days</option><option value="365">365 days</option><option value="730">730 days</option>
                </select>
              </div>
              {(() => { const b = renewTarget.license_expires_at && new Date(renewTarget.license_expires_at) > new Date() ? new Date(renewTarget.license_expires_at) : new Date(); const e = new Date(b); e.setDate(e.getDate() + parseInt(renewDays)); return <div style={{ background: '#F0FFF4', borderRadius: 8, border: '1px solid #6EC68A', padding: '10px 14px', fontSize: 13, color: '#1A7A3A', fontWeight: 600 }}>New expiry: {e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div> })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{saving ? 'Renewing...' : 'Confirm Renewal'}</button>
                <button type="button" onClick={() => setRenewTarget(null)} style={{ padding: '11px 20px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
