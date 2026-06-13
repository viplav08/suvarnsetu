'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

function daysRemaining(exp: string | null): number | null {
  if (!exp) return null
  return Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)
}

function ContactInfo() {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <a href="mailto:comedgelabs@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', border: BORDER, borderRadius: 8, textDecoration: 'none', color: TEXT, fontSize: 12.5, fontWeight: 600 }}>✉ comedgelabs@gmail.com</a>
      <a href="tel:+919581173078" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', border: BORDER, borderRadius: 8, textDecoration: 'none', color: TEXT, fontSize: 12.5, fontWeight: 600 }}>📞 +91 95811 73078</a>
    </div>
  )
}

// Pure JS CSV — no library needed
function dlCSV(rows: any[], filename: string) {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

const FD = (d: string) => !d ? '' : new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function DataExportSection({ tenant }: { tenant: any }) {
  const supabase = createClient()
  const router   = useRouter()
  const [step,   setStep]   = useState<'idle'|'downloading'|'done'>('idle')
  const [progress, setProgress] = useState('')

  async function handleDownload() {
    setStep('downloading')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tid = user.app_metadata?.tenant_id
    const shopName = (tenant?.shop_name ?? 'shop').replace(/[^a-zA-Z0-9]/g, '_')
    const date     = new Date().toISOString().split('T')[0]

    try {
      // Fetch all data
      setProgress('Fetching customers…')
      const { data: cu } = await supabase.from('customers').select('customer_id,full_name,mobile,whatsapp,email,address,spouse_name,birth_date,anniversary_date,created_at').eq('tenant_id', tid)

      setProgress('Fetching enrollments…')
      const { data: en } = await supabase.from('enrollments').select('enrollment_id,monthly_amount,signup_date,due_day,scheme_type,status,created_at,customers(full_name,customer_id)').eq('tenant_id', tid)

      setProgress('Fetching payments…')
      const { data: pa } = await supabase.from('payments').select('payment_id,payment_date,months_paid_for,amount_received,payment_mode,transaction_id,remarks,enrollments(enrollment_id,customers(full_name,customer_id))').eq('tenant_id', tid).order('payment_date')

      setProgress('Fetching closures…')
      const { data: cl } = await supabase.from('account_closures').select('closure_date,reason,total_amount_paid,months_paid,bonus_applied,final_amount,gold_rate_22k,gold_grams,enrollments(enrollment_id,customers(full_name,customer_id))').eq('tenant_id', tid)

      setProgress('Fetching gold rates…')
      const { data: gr } = await supabase.from('gold_rates').select('date,rate_22k,rate_24k').eq('tenant_id', tid).order('date')

      setProgress('Fetching employees…')
      const { data: em } = await supabase.from('employees').select('name,mobile,email,role,address').eq('tenant_id', tid)

      // Build rows
      const custRows = (cu ?? []).map(c => ({ 'Customer ID': c.customer_id, 'Full Name': c.full_name, 'Mobile': c.mobile, 'WhatsApp': c.whatsapp ?? '', 'Email': c.email ?? '', 'Address': c.address ?? '', 'Spouse Name': c.spouse_name ?? '', 'Date of Birth': FD(c.birth_date), 'Anniversary': FD(c.anniversary_date), 'Joined On': FD(c.created_at) }))
      const enRows   = (en ?? []).map((e: any) => ({ 'Enrollment ID': e.enrollment_id, 'Customer ID': e.customers?.customer_id ?? '', 'Customer Name': e.customers?.full_name ?? '', 'Monthly (Rs)': e.monthly_amount, 'Start Date': FD(e.signup_date), 'Due Day': e.due_day, 'Scheme Type': e.scheme_type, 'Status': e.status }))
      const paRows   = (pa ?? []).map((p: any) => ({ 'Payment ID': p.payment_id, 'Customer': p.enrollments?.customers?.full_name ?? '', 'Customer ID': p.enrollments?.customers?.customer_id ?? '', 'Enrollment': p.enrollments?.enrollment_id ?? '', 'Date': FD(p.payment_date), 'Months': p.months_paid_for, 'Amount (Rs)': p.amount_received, 'Mode': p.payment_mode, 'Transaction ID': p.transaction_id ?? '', 'Remarks': p.remarks ?? '' }))
      const clRows   = (cl ?? []).map((c: any) => ({ 'Customer': c.enrollments?.customers?.full_name ?? '', 'Customer ID': c.enrollments?.customers?.customer_id ?? '', 'Enrollment': c.enrollments?.enrollment_id ?? '', 'Closure Date': FD(c.closure_date), 'Reason': c.reason, 'Months Paid': c.months_paid, 'Total Paid (Rs)': c.total_amount_paid, 'Bonus': c.bonus_applied ? 'Yes' : 'No', 'Final Amount (Rs)': c.final_amount, 'Gold Rate 22K': c.gold_rate_22k ?? '', 'Gold Grams': c.gold_grams ?? '' }))
      const grRows   = (gr ?? []).map(g => ({ 'Date': FD(g.date), '22K Rate (Rs/g)': g.rate_22k, '24K Rate (Rs/g)': g.rate_24k }))
      const emRows   = (em ?? []).map(e => ({ 'Name': e.name, 'Mobile': e.mobile ?? '', 'Email': e.email ?? '', 'Role': e.role ?? '', 'Address': e.address ?? '' }))

      // Download CSVs one by one with small delay (browser allows sequential downloads)
      setProgress('Downloading 1/6 — Customers…')
      dlCSV(custRows.length > 0 ? custRows : [{ note: 'No data' }], `${shopName}_1_customers_${date}.csv`)
      await wait(600)

      setProgress('Downloading 2/6 — Enrollments…')
      dlCSV(enRows.length > 0 ? enRows : [{ note: 'No data' }], `${shopName}_2_enrollments_${date}.csv`)
      await wait(600)

      setProgress('Downloading 3/6 — Payments…')
      dlCSV(paRows.length > 0 ? paRows : [{ note: 'No data' }], `${shopName}_3_payments_${date}.csv`)
      await wait(600)

      setProgress('Downloading 4/6 — Closures…')
      dlCSV(clRows.length > 0 ? clRows : [{ note: 'No data' }], `${shopName}_4_closures_${date}.csv`)
      await wait(600)

      setProgress('Downloading 5/6 — Gold Rates…')
      dlCSV(grRows.length > 0 ? grRows : [{ note: 'No data' }], `${shopName}_5_gold_rates_${date}.csv`)
      await wait(600)

      setProgress('Downloading 6/6 — Employees…')
      dlCSV(emRows.length > 0 ? emRows : [{ note: 'No data' }], `${shopName}_6_employees_${date}.csv`)
      await wait(400)

      // Auto-revoke: one-time permission, resets after download
      setProgress('Revoking one-time access…')
      await fetch('/api/jeweller/reset-export', { method: 'POST' })

      setStep('done')
      setProgress('')
    } catch (err: any) {
      alert('Export error: ' + err.message)
      setStep('idle')
      setProgress('')
    }
  }

  if (step === 'done') {
    return (
      <div style={{ background: '#F0FFF4', borderRadius: 12, border: '1.5px solid #6EC68A', padding: 24, marginTop: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 8 }}>Download Complete</h2>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>
          6 CSV files have been downloaded to your device.<br />
          <strong style={{ color: TEXT }}>Export access has been automatically revoked.</strong><br />
          Contact ComedgeLabs to request access again.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #1A5FB4', padding: 24, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📥</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT }}>Download Your Data</h2>
            <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: '#FEF9E0', color: '#856404', border: '1px solid #FDE68A' }}>One-time access</span>
          </div>
          <p style={{ fontSize: 13.5, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
            Downloads 6 CSV files: <strong style={{ color: TEXT }}>Customers · Enrollments · Payments · Closures · Gold Rates · Employees</strong><br />
            <span style={{ fontSize: 12 }}>Access is automatically revoked after download.</span>
          </p>
          {progress && (
            <div style={{ background: '#EEF6FF', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 13, color: '#1A5FB4', fontWeight: 500 }}>
              ⏳ {progress}
            </div>
          )}
          <button onClick={handleDownload} disabled={step === 'downloading'}
            style={{ background: step === 'downloading' ? '#93C5FD' : '#1A5FB4', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: 8, cursor: step === 'downloading' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14 }}>
            {step === 'downloading' ? '⏳ Downloading…' : '📥 Download All Data (6 CSV files)'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StaffSection({ tenantId }: { tenantId: string }) {
  const supabase = createClient()
  const [staff,    setStaff]    = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')
  const [form,     setForm]     = useState({ name: '', email: '', password: '' })

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('staff').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('created_at')
    setStaff(data ?? [])
  }
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormErr('')
    const res  = await fetch('/api/jeweller/create-manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setFormErr(data.error); return }
    setShowForm(false); setForm({ name: '', email: '', password: '' }); load()
  }
  async function handleRemove(s: any) {
    if (!confirm(`Remove ${s.name}?`)) return
    const res  = await fetch('/api/jeweller/create-manager', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: s.id, auth_user_id: s.auth_user_id }) })
    const data = await res.json()
    if (data.success) load(); else alert(data.error)
  }

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24, marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT }}>Staff Management</h2>
        <button onClick={() => { setShowForm(!showForm); setFormErr('') }} style={{ background: showForm ? '#F5F5F5' : GOLD, color: showForm ? MUTED : '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{showForm ? '✕ Cancel' : '+ Add Manager'}</button>
      </div>
      {showForm && (
        <div style={{ background: '#FBF8F0', borderRadius: 10, border: BORDER, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.6 }}>Manager access: <strong style={{ color: TEXT }}>Customers · CRM · Daily Dues · Payments · Gold Rate</strong></div>
          {formErr && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#C03030' }}>{formErr}</div>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><Lbl t="Full Name" /><input style={inp} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Lbl t="Login Email" /><input style={inp} type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Lbl t="Password" /><input style={inp} type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={saving} style={{ background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{saving ? 'Creating...' : 'Create Manager Account'}</button>
          </form>
        </div>
      )}
      {staff.length === 0
        ? <div style={{ color: MUTED, fontSize: 13.5, fontStyle: 'italic' }}>No managers added yet.</div>
        : staff.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E5DDD0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>{s.name}</div><div style={{ fontSize: 12, color: MUTED }}>{s.email}</div></div>
            <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, background: '#EEF6FF', color: '#1A5FB4', border: '1px solid #93C5FD' }}>Manager</span>
            <button onClick={() => handleRemove(s)} style={{ background: 'transparent', border: BORDER, color: '#C03030', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Remove</button>
          </div>
        ))}
    </div>
  )
}

function LicenseSection({ tenant }: { tenant: any }) {
  const plan       = tenant?.plan ?? 'trial'
  const isTrial    = plan === 'trial'
  const trialEnd   = tenant?.trial_ends_at ?? null
  const licEnd     = tenant?.license_expires_at ?? null

  // Calendar-based days remaining
  function calDaysLeft(dateStr: string | null): number | null {
    if (!dateStr) return null
    const end = new Date(dateStr); end.setHours(23,59,59,999)
    const today = new Date(); today.setHours(0,0,0,0)
    return Math.ceil((end.getTime() - today.getTime()) / 86400000)
  }

  const days    = isTrial ? calDaysLeft(trialEnd) : calDaysLeft(licEnd)
  const expired = days !== null && days <= 0
  const urgent  = days !== null && days > 0 && days <= 7
  const warning = days !== null && days > 7 && days <= 15
  const FDL = (d: string) => !d ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const PLAN_INFO: Record<string, { label: string; color: string; bg: string }> = {
    trial:        { label: 'Free Trial',   color: '#856404', bg: '#FEF9E0' },
    starter:      { label: 'Starter',      color: '#1A5FB4', bg: '#EEF6FF' },
    growth:       { label: 'Growth',       color: '#1A7A3A', bg: '#F0FFF4' },
    professional: { label: 'Professional', color: '#5030A0', bg: '#F5F0FF' },
  }
  const pi = PLAN_INFO[plan] ?? PLAN_INFO.trial

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24, marginTop: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 16 }}>License & Subscription</h2>

      {/* Current plan badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: pi.bg, borderRadius: 10, border: `1px solid ${pi.color}33` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Current Plan</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: pi.color }}>{pi.label}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>{isTrial ? 'Trial ends' : 'Valid until'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{FDL(isTrial ? trialEnd : licEnd)}</div>
          {days !== null && days > 0 && <div style={{ fontSize: 12, color: urgent ? '#C03030' : warning ? '#C05000' : MUTED }}>{days} day{days !== 1 ? 's' : ''} remaining</div>}
          {expired && <div style={{ fontSize: 12, fontWeight: 700, color: '#C03030' }}>Expired</div>}
        </div>
      </div>

      {/* Alerts */}
      {expired  && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}><div style={{ fontWeight: 700, color: '#C03030', fontSize: 14, marginBottom: 6 }}>🔒 {isTrial ? 'Trial expired' : 'License expired'}</div><ContactInfo /></div>}
      {urgent && !expired  && <div style={{ background: '#FEF0E0', border: '1px solid #FDBA74', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}><div style={{ fontWeight: 700, color: '#C05000', fontSize: 14 }}>⚠ {isTrial ? 'Trial' : 'License'} expiring in {days} day{days !== 1 ? 's' : ''}</div><ContactInfo /></div>}
      {warning && !urgent && <div style={{ background: '#FEF9E0', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}><div style={{ fontWeight: 700, color: '#856404', fontSize: 14 }}>📅 {days} days remaining</div></div>}

      {isTrial && !expired && (
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
          Upgrade before your trial ends to keep your data and continue uninterrupted.<br />
          <strong style={{ color: TEXT }}>Contact ComedgeLabs to activate your plan.</strong>
        </div>
      )}
      <ContactInfo />
    </div>
  )
}

export default function SettingsClient({ tenant, role }: { tenant: any; role?: string }) {
  const supabase = createClient()
  const router   = useRouter()
  const isAdmin  = !role || role === 'jeweller_admin'
  const canExport = tenant?.allow_data_export === true

  const [form, setForm] = useState({
    scheme_name: tenant?.scheme_name ?? '', scheme_duration: String(tenant?.scheme_duration ?? 11),
    bonus_type: tenant?.bonus_type ?? 'one_month', bonus_value: String(tenant?.bonus_value ?? 1),
    allow_bonus_toggle: tenant?.allow_bonus_toggle ?? true,
    shop_name: tenant?.shop_name ?? '', address: tenant?.address ?? '',
    owner_name: tenant?.owner_name ?? '', mobile: tenant?.mobile ?? '', email: tenant?.email ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [schemes,      setSchemes]      = useState<any[]>([])
  const [schemeForm,   setSchemeForm]   = useState({ name: '', duration: '11', bonus_type: 'none', bonus_value: '0' })
  const [savingScheme, setSavingScheme] = useState(false)
  const [editSchemeId, setEditSchemeId] = useState<string | null>(null)

  useEffect(() => { loadSchemes() }, [])
  async function loadSchemes() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { data } = await supabase.from('schemes').select('*').eq('tenant_id', user.app_metadata?.tenant_id).order('created_at')
    setSchemes(data ?? [])
  }
  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('tenants').update({ scheme_name: form.scheme_name, scheme_duration: parseInt(form.scheme_duration), bonus_type: form.bonus_type, bonus_value: parseFloat(form.bonus_value), allow_bonus_toggle: form.allow_bonus_toggle, shop_name: form.shop_name, address: form.address, owner_name: form.owner_name, mobile: form.mobile, email: form.email }).eq('id', tenant.id)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); router.refresh()
  }
  async function handleSchemeSubmit(e: React.FormEvent) {
    e.preventDefault(); setSavingScheme(true)
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    if (editSchemeId) { await supabase.from('schemes').update({ scheme_name: schemeForm.name, duration: parseInt(schemeForm.duration), bonus_type: schemeForm.bonus_type, bonus_value: parseFloat(schemeForm.bonus_value) }).eq('id', editSchemeId); setEditSchemeId(null) }
    else { await supabase.from('schemes').insert({ tenant_id: user.app_metadata?.tenant_id, scheme_name: schemeForm.name, duration: parseInt(schemeForm.duration), bonus_type: schemeForm.bonus_type, bonus_value: parseFloat(schemeForm.bonus_value) }) }
    setSchemeForm({ name: '', duration: '11', bonus_type: 'none', bonus_value: '0' }); setSavingScheme(false); loadSchemes()
  }
  async function toggleScheme(id: string, cur: boolean) {
    await supabase.from('schemes').update({ is_active: !cur }).eq('id', id)
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, is_active: !cur } : s))
  }

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Settings</h1>
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Shop configuration, schemes and license info</p>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 18 }}>Default Scheme</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><Lbl t="Scheme Name" /><input style={inp} value={form.scheme_name} onChange={e => setForm({ ...form, scheme_name: e.target.value })} /></div>
              <div><Lbl t="Duration (months)" /><input style={inp} type="number" value={form.scheme_duration} onChange={e => setForm({ ...form, scheme_duration: e.target.value })} /></div>
              <div><Lbl t="Bonus Type" /><select style={inp} value={form.bonus_type} onChange={e => setForm({ ...form, bonus_type: e.target.value })}>{['none','one_month','custom_percentage'].map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}</select></div>
              <div><Lbl t="Bonus Value" /><input style={inp} type="number" value={form.bonus_value} onChange={e => setForm({ ...form, bonus_value: e.target.value })} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, color: TEXT }}><input type="checkbox" checked={form.allow_bonus_toggle} onChange={e => setForm({ ...form, allow_bonus_toggle: e.target.checked })} style={{ width: 15, height: 15 }} />Allow bonus toggle at closure</label>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 18 }}>Shop Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><Lbl t="Shop Name" /><input style={inp} value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} /></div>
              <div><Lbl t="Owner Name" /><input style={inp} value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} /></div>
              <div><Lbl t="Mobile" /><input style={inp} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Lbl t="Email" /><input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Lbl t="Address" /><input style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <button type="submit" disabled={saving} style={{ background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Settings'}</button>
      </form>

      {/* Schemes */}
      <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, border: BORDER, padding: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 18 }}>Schemes ({schemes.length})</h2>
        {schemes.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{s.scheme_name}</div><div style={{ fontSize: 12, color: MUTED }}>{s.duration} months · {s.bonus_type.replace(/_/g,' ')}</div></div>
            <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, border: s.is_active ? '1px solid #6EC68A' : BORDER, color: s.is_active ? '#1A7A3A' : MUTED }}>{s.is_active ? 'Active' : 'Inactive'}</span>
            <button onClick={() => { setEditSchemeId(s.id); setSchemeForm({ name: s.scheme_name, duration: String(s.duration), bonus_type: s.bonus_type, bonus_value: String(s.bonus_value) }) }} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>✎</button>
            <button onClick={() => toggleScheme(s.id, s.is_active)} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>{s.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        ))}
        <div style={{ borderTop: BORDER, paddingTop: 16, marginTop: schemes.length ? 8 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{editSchemeId ? '✎ Edit' : '+ Add New Scheme'}</div>
          <form onSubmit={handleSchemeSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 100px auto', gap: 10, alignItems: 'flex-end' }}>
              <div><Lbl t="Name" /><input style={inp} required value={schemeForm.name} onChange={e => setSchemeForm({ ...schemeForm, name: e.target.value })} /></div>
              <div><Lbl t="Duration" /><input style={inp} type="number" value={schemeForm.duration} onChange={e => setSchemeForm({ ...schemeForm, duration: e.target.value })} /></div>
              <div><Lbl t="Bonus" /><select style={inp} value={schemeForm.bonus_type} onChange={e => setSchemeForm({ ...schemeForm, bonus_type: e.target.value })}><option value="none">No Bonus</option><option value="one_month">1 Month Free</option><option value="custom_percentage">Custom %</option></select></div>
              <div><Lbl t="Value" /><input style={inp} type="number" value={schemeForm.bonus_value} onChange={e => setSchemeForm({ ...schemeForm, bonus_value: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="submit" disabled={savingScheme || !schemeForm.name} style={{ background: !schemeForm.name ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{savingScheme ? '...' : editSchemeId ? 'Update' : '+ Add'}</button>
                {editSchemeId && <button type="button" onClick={() => { setEditSchemeId(null); setSchemeForm({ name: '', duration: '11', bonus_type: 'none', bonus_value: '0' }) }} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>✕</button>}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Staff — admin only */}
      {isAdmin && <StaffSection tenantId={tenant?.id ?? ''} />}

      {/* Data Export — shown to admin only, visibility controlled by superadmin toggle */}
      {isAdmin && canExport  && <DataExportSection tenant={tenant} />}

      {/* WhatsApp Integration */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, padding: 24, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📱</div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT }}>WhatsApp Integration</h2>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Powered by AiSensy · Connect your WhatsApp Business account</div>
            </div>
          </div>
          <div style={{ background: '#FBF8F0', borderRadius: 10, border: BORDER, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: TEXT, lineHeight: 1.7 }}>
              Once connected, SuvarnSetu will automatically send:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginTop: 10 }}>
              {['✓ Payment reminders (3 days before due)', '✓ Payment receipts', '✓ Overdue alerts (weekly)', '✓ Birthday & anniversary wishes', '✓ New enrollment welcome', '✓ Scheme completion notification'].map(f => (
                <div key={f} style={{ fontSize: 12.5, color: TEXT }}>{f}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>AiSensy API Key</label>
              <input type="password" disabled placeholder="Paste your AiSensy API key here" style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#F9F9F9', color: MUTED, boxSizing: 'border-box', cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>WhatsApp Business Number</label>
              <input type="tel" disabled placeholder="+91 XXXXXXXXXX" style={{ width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#F9F9F9', color: MUTED, boxSizing: 'border-box', cursor: 'not-allowed' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button disabled style={{ background: '#F5F5F5', color: MUTED, border: BORDER, padding: '9px 20px', borderRadius: 8, cursor: 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              Connect WhatsApp
            </button>
            <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, background: '#FEF9E0', color: '#856404', border: '1px solid #FDE68A' }}>
              Coming Soon
            </span>
            <a href="https://aisensy.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: '#C09428', textDecoration: 'none', fontWeight: 600 }}>
              Get AiSensy Account →
            </a>
          </div>
        </div>
      )}

      {/* License */}
      <LicenseSection tenant={tenant} />
    </div>
  )
}
