'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const INR  = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')

export default function EmployeesPage() {
  const supabase  = createClient()
  const router    = useRouter()
  const [tab,         setTab]         = useState<'list' | 'performance'>('list')
  const [employees,   setEmployees]   = useState<any[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [payments,    setPayments]    = useState<any[]>([])
  const [tenantId,    setTenantId]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [form,        setForm]        = useState({ name: '', mobile: '', email: '', role: 'sales', address: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const tid = user.app_metadata?.tenant_id; setTenantId(tid)
    const [{ data: em }, { data: en }, { data: pa }] = await Promise.all([
      supabase.from('employees').select('*').eq('tenant_id', tid).order('name'),
      supabase.from('enrollments').select('id,enrollment_id,assigned_employee_id,monthly_amount,status,signup_date,customers(full_name)').eq('tenant_id', tid),
      supabase.from('payments').select('amount_received,enrollment_id,payment_date').eq('tenant_id', tid),
    ])
    setEmployees(em ?? [])
    setEnrollments(en ?? [])
    setPayments(pa ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('employees').insert({ tenant_id: tenantId, ...form })
    setSaving(false); setShowForm(false); setForm({ name: '', mobile: '', email: '', role: 'sales', address: '' }); load()
  }

  async function toggleActive(id: string, cur: boolean) {
    await supabase.from('employees').update({ is_active: !cur }).eq('id', id)
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, is_active: !cur } : e))
  }

  // ── Performance calculations ──────────────────────────────────────
  const performance = useMemo(() => {
    const today     = new Date(); today.setHours(0,0,0,0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    return employees.map(emp => {
      const empEnrollments = enrollments.filter(e => e.assigned_employee_id === emp.id)
      const active         = empEnrollments.filter(e => e.status === 'active')
      const closed         = empEnrollments.filter(e => e.status === 'completed')
      const foreclosed     = empEnrollments.filter(e => e.status === 'cancelled')
      const totalMRR       = active.reduce((s, e) => s + e.monthly_amount, 0)
      const thisMonthPays  = payments.filter(p => {
        const d = new Date(p.payment_date + 'T00:00:00')
        return d >= monthStart && empEnrollments.some(e => e.id === p.enrollment_id)
      })
      const collectedThisMonth = thisMonthPays.reduce((s, p) => s + p.amount_received, 0)
      const totalCollected     = payments.filter(p => empEnrollments.some(e => e.id === p.enrollment_id)).reduce((s, p) => s + p.amount_received, 0)

      return { ...emp, empEnrollments, active, closed, foreclosed, totalMRR, collectedThisMonth, totalCollected }
    })
  }, [employees, enrollments, payments])

  const inp: React.CSSProperties = { width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const Lbl = ({ t }: { t: string }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</label>
  const Th  = ({ h }: { h: string }) => <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>

  if (loading) return <div style={{ padding: 40, color: MUTED }}>Loading…</div>

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Employees</h1>
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>{employees.filter(e=>e.is_active).length} active staff</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
          + Add Employee
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', padding: 4, borderRadius: 10, border: BORDER, width: 'fit-content' }}>
        {[['list','Staff List'],['performance','Performance']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v as any)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab===v ? 700 : 400, background: tab===v ? '#1B1108' : 'transparent', color: tab===v ? '#fff' : MUTED }}>
            {l}
          </button>
        ))}
      </div>

      {/* Staff List tab */}
      {tab === 'list' && (
        <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><Th h="Name" /><Th h="Mobile" /><Th h="Email" /><Th h="Role" /><Th h="Status" /><Th h="" /></tr></thead>
            <tbody>
              {employees.length === 0
                ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: MUTED }}>No employees added yet.</td></tr>
                : employees.map(e => (
                  <tr key={e.id}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><div style={{ fontWeight: 600, color: TEXT }}>{e.name}</div></td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{e.mobile || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{e.email || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 600, background: '#F5F0E6', color: MUTED, textTransform: 'capitalize' }}>{e.role || 'Staff'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 600, background: e.is_active ? '#F0FFF4' : '#F5F5F5', color: e.is_active ? '#1A7A3A' : '#888', border: `1px solid ${e.is_active ? '#6EC68A' : '#ccc'}` }}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                      <button onClick={() => toggleActive(e.id, e.is_active)} style={{ background: 'transparent', border: BORDER, color: MUTED, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                        {e.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Performance tab */}
      {tab === 'performance' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total Active Enrollments', value: enrollments.filter(e=>e.status==='active').length, sub: 'across all staff' },
              { label: 'Total MRR Managed',         value: INR(enrollments.filter(e=>e.status==='active').reduce((s,e)=>s+e.monthly_amount,0)), sub: 'monthly recurring' },
              { label: 'Total Collected (All Time)', value: INR(payments.reduce((s,p)=>s+p.amount_received,0)), sub: 'all payments' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', borderRadius: 10, border: BORDER, padding: '18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: TEXT, marginBottom: 4 }}>{c.value}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Per-employee performance */}
          <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th h="Employee" />
                  <Th h="Active Enrollments" />
                  <Th h="Monthly Revenue (MRR)" />
                  <Th h="Collected This Month" />
                  <Th h="Total Collected" />
                  <Th h="Completed" />
                  <Th h="Foreclosed" />
                </tr>
              </thead>
              <tbody>
                {performance.length === 0
                  ? <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: MUTED }}>No employees yet.</td></tr>
                  : performance.map(emp => (
                    <tr key={emp.id}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                        <div style={{ fontWeight: 600, color: TEXT }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: MUTED, textTransform: 'capitalize' }}>{emp.role || 'Staff'}</div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: emp.active.length > 0 ? TEXT : MUTED, fontSize: 18, fontFamily: 'var(--font-cormorant), serif' }}>
                        {emp.active.length}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontWeight: 700, color: GOLD }}>
                        {emp.totalMRR > 0 ? INR(emp.totalMRR) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: emp.collectedThisMonth > 0 ? '#1A7A3A' : MUTED, fontWeight: emp.collectedThisMonth > 0 ? 700 : 400 }}>
                        {emp.collectedThisMonth > 0 ? INR(emp.collectedThisMonth) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>
                        {emp.totalCollected > 0 ? INR(emp.totalCollected) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: '#1A7A3A', fontSize: 13 }}>
                        {emp.closed.length > 0 ? emp.closed.length : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: emp.foreclosed.length > 0 ? '#C03030' : MUTED, fontSize: 13 }}>
                        {emp.foreclosed.length > 0 ? emp.foreclosed.length : '—'}
                      </td>
                    </tr>
                  ))}

                {/* Unassigned row */}
                {(() => {
                  const unassigned = enrollments.filter(e => !e.assigned_employee_id && e.status === 'active')
                  if (unassigned.length === 0) return null
                  return (
                    <tr style={{ background: '#F9F9F9' }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}><div style={{ color: MUTED, fontStyle: 'italic' }}>Not assigned</div></td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED }}>{unassigned.length}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED }}>{INR(unassigned.reduce((s,e)=>s+e.monthly_amount,0))}</td>
                      <td colSpan={4} style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: MUTED, fontSize: 12 }}>—</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Employee Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>Add Employee</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Lbl t="Full Name" /><input style={inp} required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Lbl t="Mobile" /><input style={inp} type="tel" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} /></div>
                <div><Lbl t="Email" /><input style={inp} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Lbl t="Role" />
                  <select style={inp} value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="sales">Sales</option>
                    <option value="manager">Manager</option>
                    <option value="accounts">Accounts</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div><Lbl t="Address (optional)" /><input style={inp} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {saving ? 'Saving...' : '+ Add Employee'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '11px 18px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
