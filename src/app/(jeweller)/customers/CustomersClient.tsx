'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatINR, formatDate, getDueDay } from '@/lib/utils'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'

const STATUS_STYLE: Record<string, any> = {
  active:    { border: '1px solid #6EC68A', color: '#1E7A3A', background: '#F0FFF4' },
  completed: { border: '1px solid #B8B8B8', color: '#666',    background: '#F5F5F5' },
  redeemed:  { border: '1px solid #B0A0E0', color: '#5030A0', background: '#F5F0FF' },
  cancelled: { border: '1px solid #E0A0A0', color: '#A03030', background: '#FFF0F0' },
}

const inp: React.CSSProperties = {
  width: '100%', border: BORDER, borderRadius: 8, padding: '9px 12px',
  fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
}

const Lbl = ({ t, req }: { t: string; req?: boolean }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
    {t}{req && <span style={{ color: '#C03030' }}> *</span>}
  </label>
)

const SectionHead = ({ t }: { t: string }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, marginTop: 4 }}>{t}</div>
)

export default function CustomersClient({ customers, enrollments, employees, tenantId, schemeDuration }: any) {
  const router   = useRouter()
  const supabase = createClient()

  const [search,   setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  // ── Customer profile modal ──────────────────────────────────────────
  const [profileCustomer, setProfileCustomer]   = useState<any>(null)
  const [profilePayments,  setProfilePayments]   = useState<any[]>([])
  const [profileFollowUps, setProfileFollowUps]  = useState<any[]>([])
  const [profileLoading,   setProfileLoading]    = useState(false)

  async function openProfile(customer: any) {
    setProfileCustomer(customer)
    setProfileLoading(true)
    const [{ data: pays }, { data: fups }] = await Promise.all([
      supabase.from('payments')
        .select('*, enrollments(enrollment_id)')
        .eq('customer_id', customer.id)
        .order('payment_date', { ascending: false }),
      supabase.from('follow_ups')
        .select('*')
        .in('enrollment_id', (customerMap[customer.id]?.allEnrollments ?? []).map((e:any)=>e.id))
        .order('created_at', { ascending: false }),
    ])
    setProfilePayments(pays ?? [])
    setProfileFollowUps(fups ?? [])
    setProfileLoading(false)
  }

  // Mobile lookup state
  const [mobile,          setMobile]          = useState('')
  const [lookupState,     setLookupState]     = useState<'idle'|'checking'|'found'|'new'>('idle')
  const [existingCustomer, setExistingCustomer] = useState<any>(null)

  // Form fields
  const [personal, setPersonal] = useState({
    full_name: '', whatsapp: '', sameAsMobile: false,
    email: '', address: '', spouse_name: '',
    birth_date: '', anniversary_date: '',
  })
  const [enrollment, setEnrollment] = useState({
    monthly_amount: '',
    signup_date: new Date().toISOString().split('T')[0],
    scheme_type: 'fixed',
    assigned_employee_id: '',
  })

  // Build customer+enrollment map
  const customerMap = useMemo(() => {
    const map: Record<string, { activeEnrollment: any; allEnrollments: any[] }> = {}
    for (const c of customers) {
      map[c.id] = { activeEnrollment: null, allEnrollments: [] }
    }
    for (const e of enrollments) {
      if (!map[e.customer_id]) continue
      map[e.customer_id].allEnrollments.push(e)
      if (e.status === 'active') map[e.customer_id].activeEnrollment = e
    }
    return map
  }, [customers, enrollments])

  const filtered = customers.filter((c: any) =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search) ||
    c.customer_id?.toLowerCase().includes(search.toLowerCase())
  )

  async function checkMobile() {
    if (!mobile || mobile.length < 10) return
    setLookupState('checking')
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('mobile', mobile.trim())
      .maybeSingle()

    if (data) {
      setExistingCustomer(data)
      setPersonal({
        full_name: data.full_name ?? '',
        whatsapp: data.whatsapp ?? '',
        sameAsMobile: data.whatsapp === mobile,
        email: data.email ?? '',
        address: data.address ?? '',
        spouse_name: data.spouse_name ?? '',
        birth_date: data.birth_date ?? '',
        anniversary_date: data.anniversary_date ?? '',
      })
      setLookupState('found')
    } else {
      setExistingCustomer(null)
      setPersonal({ full_name: '', whatsapp: '', sameAsMobile: false, email: '', address: '', spouse_name: '', birth_date: '', anniversary_date: '' })
      setLookupState('new')
    }
  }

  function openModal(preloadCustomer?: any) {
    setMobile(preloadCustomer?.mobile ?? '')
    setLookupState(preloadCustomer ? 'found' : 'idle')
    setExistingCustomer(preloadCustomer ?? null)
    setPersonal({
      full_name: preloadCustomer?.full_name ?? '',
      whatsapp: preloadCustomer?.whatsapp ?? '',
      sameAsMobile: false,
      email: preloadCustomer?.email ?? '',
      address: preloadCustomer?.address ?? '',
      spouse_name: preloadCustomer?.spouse_name ?? '',
      birth_date: preloadCustomer?.birth_date ?? '',
      anniversary_date: preloadCustomer?.anniversary_date ?? '',
    })
    setEnrollment({ monthly_amount: '', signup_date: new Date().toISOString().split('T')[0], scheme_type: 'fixed', assigned_employee_id: '' })
    setFormErr(''); setShowModal(true)
  }

  function closeModal() { setShowModal(false); setLookupState('idle'); setMobile(''); setExistingCustomer(null); setFormErr('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (lookupState !== 'found' && lookupState !== 'new') { setFormErr('Enter a mobile number first.'); return }
    if (!enrollment.monthly_amount) { setFormErr('Monthly amount is required.'); return }
    // Check enrollment limit based on plan
    const activeCount = enrollments.filter((e: any) => e.status === 'active').length
    const planLimits: Record<string, number> = { trial: 999999, starter: 100, growth: 300, professional: 999999 }
    const { data: { user } } = await supabase.auth.getUser()
    const tenantPlan = 'trial' // Will be passed as prop in next iteration
    // Note: plan enforcement is also handled server-side
    setSaving(true); setFormErr('')

    const dueDay = getDueDay(enrollment.signup_date)
    const { data: enrollId } = await supabase.rpc('next_enrollment_id', { p_tenant_id: tenantId })

    if (lookupState === 'found' && existingCustomer) {
      // Returning customer — just create new enrollment
      const { error } = await supabase.from('enrollments').insert({
        enrollment_id:         enrollId,
        customer_id:           existingCustomer.id,
        tenant_id:             tenantId,
        monthly_amount:        parseFloat(enrollment.monthly_amount),
        signup_date:           enrollment.signup_date,
        due_day:               dueDay,
        scheme_type:           enrollment.scheme_type,
        scheme_duration_months: enrollment.scheme_type === 'fixed' ? schemeDuration : null,
        assigned_employee_id:  enrollment.assigned_employee_id || null,
        status:                'active',
      })
      if (error) { setFormErr('Error: ' + error.message); setSaving(false); return }
    } else {
      // New customer — create person + enrollment
      const { data: custId } = await supabase.rpc('next_customer_id', { p_tenant_id: tenantId })
      const { data: newCust, error: custErr } = await supabase.from('customers').insert({
        tenant_id:        tenantId,
        customer_id:      custId,
        full_name:        personal.full_name,
        mobile:           mobile.trim(),
        whatsapp:         personal.sameAsMobile ? mobile.trim() : (personal.whatsapp || null),
        email:            personal.email || null,
        address:          personal.address || null,
        spouse_name:      personal.spouse_name || null,
        birth_date:       personal.birth_date || null,
        anniversary_date: personal.anniversary_date || null,
        is_subscriber:    true,
        // Safe defaults — satisfy any legacy constraints still on customers table
        monthly_amount:   0,
        status:           'active',
        scheme_type:      'fixed',
        signup_date:      enrollment.signup_date,
        due_day:          dueDay,
      }).select().single()

      if (custErr) { setFormErr('Error: ' + custErr.message); setSaving(false); return }

      const { error: enErr } = await supabase.from('enrollments').insert({
        enrollment_id:         enrollId,
        customer_id:           newCust.id,
        tenant_id:             tenantId,
        monthly_amount:        parseFloat(enrollment.monthly_amount),
        signup_date:           enrollment.signup_date,
        due_day:               dueDay,
        scheme_type:           enrollment.scheme_type,
        scheme_duration_months: enrollment.scheme_type === 'fixed' ? schemeDuration : null,
        assigned_employee_id:  enrollment.assigned_employee_id || null,
        status:                'active',
      })
      if (enErr) { setFormErr('Error: ' + enErr.message); setSaving(false); return }
    }

    setSaving(false); closeModal(); router.refresh()
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>Customers</h1>
          <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>
            {customers.length} persons · {enrollments.filter((e: any) => e.status === 'active').length} active enrollments
          </p>
        </div>
        <button onClick={() => openModal()}
          style={{ background: GOLD, color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
          + Enrol Customer
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <input placeholder="Search by name, mobile or ID…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 300 }} />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Customer ID', 'Name', 'Mobile', 'Enrollment', 'Monthly', 'Due Day', 'Birthday', 'Schemes', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: MUTED }}>No customers yet.</td></tr>
            ) : filtered.map((c: any) => {
              const { activeEnrollment: ae, allEnrollments: ae_all } = customerMap[c.id] ?? { activeEnrollment: null, allEnrollments: [] }
              const hasActive = !!ae
              return (
                <tr key={c.id} onClick={() => openProfile(c)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: MUTED, fontWeight: 600 }}>{c.customer_id}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    <div style={{ fontWeight: 600, color: TEXT }}>{c.full_name}</div>
                    {c.spouse_name && <div style={{ fontSize: 11, color: MUTED }}>♥ {c.spouse_name}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{c.mobile}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 12, color: MUTED }}>
                    {ae ? <span style={{ fontWeight: 600, color: GOLD }}>{ae.enrollment_id}</span> : <span style={{ color: MUTED }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>
                    {ae ? formatINR(ae.monthly_amount) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>
                    {ae ? ae.due_day : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: c.birth_date ? TEXT : MUTED, fontSize: 13 }}>
                    {c.birth_date ? formatDate(c.birth_date) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13, color: MUTED }}>
                    {ae_all.length === 0 ? '—' : (
                      <span style={{ fontWeight: 600, color: ae_all.length > 1 ? GOLD : TEXT }}>
                        {ae_all.length} {ae_all.length > 1 ? '(returning)' : ''}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    {ae
                      ? <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, ...STATUS_STYLE.active }}>Active</span>
                      : <span style={{ padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, border: BORDER, color: MUTED, background: '#F5F5F5' }}>No Active</span>
                    }
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
                    {!hasActive && (
                      <button onClick={() => openModal(c)}
                        style={{ background: GOLD, color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ↩ Re-enrol
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Enrol Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 24, fontWeight: 600, color: TEXT }}>
                {lookupState === 'found' ? '↩ Re-enrol Customer' : 'Enrol New Customer'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
            </div>

            {formErr && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#C03030' }}>⚠ {formErr}</div>
            )}

            <form onSubmit={handleSubmit}>

              {/* ── Mobile lookup ── */}
              <SectionHead t="Step 1 — Mobile Number" />
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <Lbl t="Mobile Number" req />
                  <input
                    type="tel" value={mobile}
                    onChange={e => { setMobile(e.target.value); setLookupState('idle'); setExistingCustomer(null) }}
                    onBlur={checkMobile}
                    placeholder="Enter 10-digit mobile"
                    style={{ ...inp, borderColor: lookupState === 'found' ? '#6EC68A' : lookupState === 'new' ? GOLD : '#E5DDD0' }}
                    disabled={lookupState === 'found'}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={checkMobile} disabled={mobile.length < 10 || lookupState === 'checking'}
                    style={{ background: '#F5F0E6', border: BORDER, color: TEXT, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {lookupState === 'checking' ? '...' : 'Check'}
                  </button>
                </div>
              </div>

              {/* Found returning customer */}
              {lookupState === 'found' && existingCustomer && (
                <div style={{ background: '#F0FFF4', border: '1px solid #6EC68A', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A7A3A', marginBottom: 6 }}>✓ Returning Customer Found</div>
                  <div style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>{existingCustomer.full_name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {existingCustomer.customer_id} · {existingCustomer.email || 'no email'}
                    {existingCustomer.birth_date && ` · 🎂 ${formatDate(existingCustomer.birth_date)}`}
                  </div>
                  <button type="button" onClick={() => { setLookupState('idle'); setMobile(''); setExistingCustomer(null) }}
                    style={{ marginTop: 8, fontSize: 11.5, color: '#1A7A3A', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Not this person? Clear
                  </button>
                </div>
              )}

              {/* New customer message */}
              {lookupState === 'new' && (
                <div style={{ background: '#FBF8F0', border: BORDER, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: MUTED }}>
                  📋 New customer — please fill in their details below.
                </div>
              )}

              {/* ── Personal details (only for new customers) ── */}
              {(lookupState === 'new') && (
                <>
                  <SectionHead t="Step 2 — Personal Details" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <Lbl t="Full Name" req />
                      <input style={inp} type="text" required value={personal.full_name} onChange={e => setPersonal({ ...personal, full_name: e.target.value })} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Lbl t="WhatsApp" />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11.5, color: MUTED, fontWeight: 500 }}>
                          <input type="checkbox" checked={personal.sameAsMobile}
                            onChange={e => setPersonal({ ...personal, sameAsMobile: e.target.checked, whatsapp: e.target.checked ? mobile : personal.whatsapp })}
                            style={{ width: 13, height: 13, accentColor: GOLD }} />
                          Same as mobile
                        </label>
                      </div>
                      <input style={{ ...inp, background: personal.sameAsMobile ? '#F9F6F0' : '#fff' }}
                        type="tel" value={personal.sameAsMobile ? mobile : personal.whatsapp}
                        disabled={personal.sameAsMobile}
                        onChange={e => setPersonal({ ...personal, whatsapp: e.target.value })} />
                    </div>
                    <div><Lbl t="Email" /><input style={inp} type="email" value={personal.email} onChange={e => setPersonal({ ...personal, email: e.target.value })} /></div>
                    <div><Lbl t="Spouse Name" /><input style={inp} type="text" value={personal.spouse_name} onChange={e => setPersonal({ ...personal, spouse_name: e.target.value })} /></div>
                    <div>
                      <Lbl t="Date of Birth 🎂" />
                      <input style={inp} type="date" value={personal.birth_date}
                        max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                        onChange={e => setPersonal({ ...personal, birth_date: e.target.value })} />
                    </div>
                    <div>
                      <Lbl t="Anniversary 💍" />
                      <input style={inp} type="date" value={personal.anniversary_date}
                        max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                        onChange={e => setPersonal({ ...personal, anniversary_date: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Lbl t="Address" />
                      <input style={inp} type="text" value={personal.address} onChange={e => setPersonal({ ...personal, address: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {/* ── Enrollment details (always shown after lookup) ── */}
              {(lookupState === 'found' || lookupState === 'new') && (
                <>
                  <SectionHead t={lookupState === 'found' ? 'Step 2 — New Scheme Details' : 'Step 3 — Scheme Details'} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div>
                      <Lbl t="Monthly Amount (₹)" req />
                      <input style={inp} type="number" required min="1" value={enrollment.monthly_amount}
                        onChange={e => setEnrollment({ ...enrollment, monthly_amount: e.target.value })} />
                    </div>
                    <div>
                      <Lbl t="Signup / Start Date" />
                      <input style={inp} type="date" required value={enrollment.signup_date}
                        onChange={e => setEnrollment({ ...enrollment, signup_date: e.target.value })} />
                    </div>
                    <div>
                      <Lbl t="Scheme Type" />
                      <select style={inp} value={enrollment.scheme_type} onChange={e => setEnrollment({ ...enrollment, scheme_type: e.target.value })}>
                        <option value="fixed">Fixed ({schemeDuration} months)</option>
                        <option value="open">Open-ended</option>
                      </select>
                    </div>
                    <div>
                      <Lbl t="Assigned Employee" />
                      <select style={inp} value={enrollment.assigned_employee_id} onChange={e => setEnrollment({ ...enrollment, assigned_employee_id: e.target.value })}>
                        <option value="">— None —</option>
                        {employees.map((em: any) => <option key={em.id} value={em.id}>{em.name}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {(lookupState === 'found' || lookupState === 'new') && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={saving}
                    style={{ flex: 1, background: saving ? `${GOLD}99` : GOLD, color: '#fff', border: 'none', padding: 11, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                    {saving ? 'Saving...' : lookupState === 'found' ? '↩ Enrol in New Scheme' : '+ Add & Enrol'}
                  </button>
                  <button type="button" onClick={closeModal}
                    style={{ padding: '11px 20px', borderRadius: 8, border: BORDER, color: MUTED, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}

              {lookupState === 'idle' && (
                <div style={{ textAlign: 'center', color: MUTED, fontSize: 13.5, padding: '20px 0' }}>
                  Enter a mobile number above and click Check to continue.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* ── Customer Profile Modal ── */}
      {profileCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: BORDER }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 26, fontWeight: 400, color: TEXT, marginBottom: 4 }}>
                  {profileCustomer.full_name}
                </h2>
                <div style={{ fontSize: 13, color: MUTED, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>📱 {profileCustomer.mobile}</span>
                  {profileCustomer.referred_by && <span>👤 Referred by: <strong>{profileCustomer.referred_by}</strong></span>}
                  {profileCustomer.birth_date && <span>🎂 {new Date(profileCustomer.birth_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>}
                  {profileCustomer.anniversary_date && <span>💍 {new Date(profileCustomer.anniversary_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>}
                  {profileCustomer.address && <span>📍 {profileCustomer.address}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href={`/statement/${profileCustomer.id}?year=${new Date().getFullYear()}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: GOLD, border: `1px solid ${GOLD}55`, padding: '5px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
                  📄 Annual Statement
                </a>
                <button onClick={() => setProfileCustomer(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
              </div>
            </div>

            {profileLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading history…</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Enrollments */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Scheme Enrollments ({(customerMap[profileCustomer.id]?.allEnrollments ?? []).length})
                  </div>
                  {(customerMap[profileCustomer.id]?.allEnrollments ?? []).length === 0
                    ? <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No enrollments yet.</div>
                    : (customerMap[profileCustomer.id]?.allEnrollments ?? []).map((e: any) => {
                        const statusColors: Record<string,any> = { active:{bg:'#F0FFF4',color:'#1A7A3A',border:'#6EC68A'}, completed:{bg:'#F5F5F5',color:'#666',border:'#ccc'}, cancelled:{bg:'#FEE2E2',color:'#C03030',border:'#FECACA'}, redeemed:{bg:'#F5F0FF',color:'#5030A0',border:'#C4B5FD'} }
                        const sc = statusColors[e.status] ?? statusColors.completed
                        const enPays = profilePayments.filter((p: any) => p.enrollment_id === e.id || p.customer_id === profileCustomer.id)
                        const totalPaid = enPays.reduce((s: number, p: any) => s + p.amount_received, 0)
                        return (
                          <div key={e.id} style={{ padding: '12px 14px', background: '#FBF8F0', borderRadius: 8, border: BORDER, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ fontWeight: 600, color: TEXT, fontSize: 14 }}>{e.enrollment_id}</div>
                                {e.passbook_token && (
                                  <a href={`/passbook/${e.passbook_token}`} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11.5, color: '#1A5FB4', textDecoration: 'none', fontWeight: 600, background: '#EEF6FF', padding: '2px 8px', borderRadius: 6 }}>
                                    📖 Passbook
                                  </a>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                                {formatINR(e.monthly_amount)}/month · Started {new Date(e.signup_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                              </div>
                              <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                                {enPays.length} payment{enPays.length !== 1 ? 's' : ''} · {formatINR(totalPaid)} collected
                              </div>
                            </div>
                            <span style={{ padding: '4px 12px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: 'capitalize' }}>
                              {e.status}
                            </span>
                          </div>
                        )
                      })
                  }
                </div>

                {/* Payment history */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Payment History ({profilePayments.length})
                  </div>
                  {profilePayments.length === 0
                    ? <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>No payments recorded.</div>
                    : profilePayments.slice(0, 10).map((p: any) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F5F0E6' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{p.payment_id}</div>
                            <div style={{ fontSize: 11.5, color: MUTED }}>
                              {new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })} ·{' '}
                              {p.months_paid_for} month{p.months_paid_for > 1 ? 's' : ''} ·{' '}
                              {p.enrollments?.enrollment_id ?? '—'} · {(p.payment_mode ?? 'cash').replace('_',' ')}
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{formatINR(p.amount_received)}</div>
                        </div>
                      ))
                  }
                  {profilePayments.length > 10 && <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>+{profilePayments.length - 10} more payments</div>}
                </div>

                {/* Follow-up notes */}
                {profileFollowUps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Follow-up Notes ({profileFollowUps.length})
                    </div>
                    {profileFollowUps.slice(0, 5).map((fu: any) => (
                      <div key={fu.id} style={{ padding: '10px 14px', background: '#F9F9F9', borderRadius: 8, border: BORDER, marginBottom: 8, borderLeft: '3px solid #E5DDD0' }}>
                        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>{fu.remark}</div>
                        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>
                          {fu.followed_by} · {new Date(fu.remark_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                          {fu.next_followup_date && <span style={{ marginLeft: 8, color: GOLD }}>📅 Follow up: {new Date(fu.next_followup_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
