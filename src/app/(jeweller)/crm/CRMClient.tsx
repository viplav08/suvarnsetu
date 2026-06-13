'use client'
import { useState, useMemo } from 'react'

const TEXT = '#1A1008', MUTED = '#7A6A5A', GOLD = '#C09428', BORDER = '1px solid #E5DDD0'

function getDayMonth(dateStr: string | null): { day: number; month: number } | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return { day: d.getDate(), month: d.getMonth() + 1 }
}

function daysUntil(day: number, month: number): number {
  const now   = new Date(); now.setHours(0,0,0,0)
  const year  = now.getFullYear()
  let target  = new Date(year, month - 1, day); target.setHours(0,0,0,0)
  if (target < now) target = new Date(year + 1, month - 1, day)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function CRMClient({ customers, shopName, shopMobile }: any) {
  const [tab,    setTab]    = useState<'upcoming'|'all'>('upcoming')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'birthday'|'anniversary'>('all')

  const today = new Date(); today.setHours(0,0,0,0)

  // Build enriched customer list
  const enriched = useMemo(() => customers.map((c: any) => {
    const bd   = getDayMonth(c.birth_date)
    const ann  = getDayMonth(c.anniversary_date)
    const bdDays  = bd  ? daysUntil(bd.day, bd.month)   : null
    const annDays = ann ? daysUntil(ann.day, ann.month)  : null
    const activeEnrollment = (c.enrollments ?? []).find((e: any) => e.status === 'active')
    const isToday = (bdDays === 0 || annDays === 0)
    return { ...c, bdDays, annDays, activeEnrollment, isToday }
  }), [customers])

  const upcoming = enriched
    .filter((c: any) => c.bdDays !== null && c.bdDays <= 7 || c.annDays !== null && c.annDays <= 7)
    .sort((a: any, b: any) => {
      const aMin = Math.min(a.bdDays ?? 999, a.annDays ?? 999)
      const bMin = Math.min(b.bdDays ?? 999, b.annDays ?? 999)
      return aMin - bMin
    })

  const todayList   = enriched.filter((c: any) => c.isToday)
  const filteredAll = enriched.filter((c: any) => {
    if (search && !c.full_name.toLowerCase().includes(search.toLowerCase()) && !c.mobile?.includes(search)) return false
    if (filter === 'birthday')   return c.birth_date
    if (filter === 'anniversary') return c.anniversary_date
    return true
  })

  // WhatsApp message generators
  function birthdayMsg(name: string): string {
    return `🎂 Happy Birthday ${name}!\n\nWishing you a wonderful day filled with joy and prosperity.\n\n— ${shopName}`
  }
  function anniversaryMsg(name: string): string {
    return `💍 Happy Anniversary ${name}!\n\nWishing you many more years of happiness together.\n\n— ${shopName}`
  }
  function sendWA(phone: string, msg: string) {
    const cleaned = phone.replace(/\D/g, '')
    const number  = cleaned.startsWith('91') ? cleaned : '91' + cleaned
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const Th = ({ t }: { t: string }) => (
    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: BORDER, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{t}</th>
  )

  function CustomerRow({ c, showBd, showAnn }: any) {
    const phone = c.whatsapp || c.mobile
    return (
      <tr>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ fontWeight: 600, color: TEXT }}>{c.full_name}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{c.customer_id}</div>
        </td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', color: TEXT, fontSize: 13 }}>{c.mobile}</td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0', fontSize: 13 }}>
          {c.activeEnrollment
            ? <span style={{ color: '#1A7A3A', fontWeight: 600 }}>Active · {c.activeEnrollment.enrollment_id}</span>
            : <span style={{ color: MUTED }}>No active scheme</span>}
        </td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          {c.birth_date && (
            <div style={{ marginBottom: showAnn && c.anniversary_date ? 6 : 0 }}>
              <div style={{ fontSize: 12.5, color: c.bdDays === 0 ? '#C03030' : TEXT, fontWeight: c.bdDays === 0 ? 700 : 400 }}>
                🎂 {formatDate(c.birth_date)}
                {c.bdDays === 0 && <span style={{ marginLeft: 6, background: '#FEE2E2', color: '#C03030', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>TODAY!</span>}
                {c.bdDays !== null && c.bdDays > 0 && c.bdDays <= 7 && <span style={{ marginLeft: 6, color: GOLD, fontSize: 11 }}>in {c.bdDays}d</span>}
              </div>
            </div>
          )}
          {c.anniversary_date && (
            <div>
              <div style={{ fontSize: 12.5, color: c.annDays === 0 ? '#C03030' : TEXT, fontWeight: c.annDays === 0 ? 700 : 400 }}>
                💍 {formatDate(c.anniversary_date)}
                {c.annDays === 0 && <span style={{ marginLeft: 6, background: '#FEE2E2', color: '#C03030', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>TODAY!</span>}
                {c.annDays !== null && c.annDays > 0 && c.annDays <= 7 && <span style={{ marginLeft: 6, color: GOLD, fontSize: 11 }}>in {c.annDays}d</span>}
              </div>
            </div>
          )}
          {!c.birth_date && !c.anniversary_date && <span style={{ color: MUTED, fontSize: 12 }}>—</span>}
        </td>
        <td style={{ padding: '12px 14px', borderBottom: '1px solid #F0EAE0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {c.birth_date && phone && (
              <button onClick={() => sendWA(phone, birthdayMsg(c.full_name))}
                style={{ background: '#25D366', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                🎂 WA Wish
              </button>
            )}
            {c.anniversary_date && phone && (
              <button onClick={() => sendWA(phone, anniversaryMsg(c.full_name))}
                style={{ background: '#25D366', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                💍 WA Wish
              </button>
            )}
            {!phone && <span style={{ fontSize: 11.5, color: MUTED, fontStyle: 'italic' }}>No WhatsApp</span>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 36, fontWeight: 400, color: TEXT }}>CRM</h1>
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Birthday & anniversary tracking for {customers.length} customers</p>
      </div>

      {/* Today alerts */}
      {todayList.length > 0 && (
        <div style={{ background: '#FEF9E0', border: '1px solid #FDE68A', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#856404', marginBottom: 8 }}>🎉 {todayList.length} celebration{todayList.length > 1 ? 's' : ''} today!</div>
          {todayList.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #FDE68A' }}>
              <span style={{ fontWeight: 600, color: TEXT, fontSize: 13.5 }}>
                {c.bdDays === 0 ? '🎂' : '💍'} {c.full_name}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.bdDays === 0 && (c.whatsapp || c.mobile) && (
                  <button onClick={() => sendWA(c.whatsapp || c.mobile, birthdayMsg(c.full_name))}
                    style={{ background: '#25D366', color: '#fff', border: 'none', padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Send Birthday Wish 🎂
                  </button>
                )}
                {c.annDays === 0 && (c.whatsapp || c.mobile) && (
                  <button onClick={() => sendWA(c.whatsapp || c.mobile, anniversaryMsg(c.full_name))}
                    style={{ background: '#25D366', color: '#fff', border: 'none', padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Send Anniversary Wish 💍
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: '#fff', padding: 4, borderRadius: 10, border: BORDER, width: 'fit-content' }}>
        {[['upcoming', `Upcoming 7 Days (${upcoming.length})`], ['all', `All Customers (${customers.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as any)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === v ? 700 : 400, background: tab === v ? GOLD : 'transparent', color: tab === v ? '#fff' : MUTED }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', width: 240 }} />
          {['all','birthday','anniversary'].map(f => (
            <button key={f} onClick={() => setFilter(f as any)}
              style={{ padding: '7px 14px', borderRadius: 8, border: BORDER, cursor: 'pointer', fontSize: 12.5, fontWeight: filter === f ? 700 : 400, background: filter === f ? '#1B1108' : 'transparent', color: filter === f ? '#fff' : MUTED, textTransform: 'capitalize' }}>
              {f === 'all' ? 'All' : f === 'birthday' ? '🎂 Birthdays' : '💍 Anniversaries'}
            </button>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: BORDER, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><Th t="Customer" /><Th t="Mobile" /><Th t="Scheme" /><Th t="Birthday / Anniversary" /><Th t="Send Wish" /></tr></thead>
          <tbody>
            {(tab === 'upcoming' ? upcoming : filteredAll).length === 0
              ? <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: MUTED }}>
                  {tab === 'upcoming' ? 'No birthdays or anniversaries in the next 7 days.' : 'No customers found.'}
                </td></tr>
              : (tab === 'upcoming' ? upcoming : filteredAll).map((c: any) => (
                <CustomerRow key={c.id} c={c} showBd showAnn />
              ))}
          </tbody>
        </table>
      </div>

      {/* Month-wise summary */}
      {tab === 'all' && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, border: BORDER, padding: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT, marginBottom: 14 }}>Birthdays by Month</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {MONTHS.map((m, idx) => {
              const count = customers.filter((c: any) => c.birth_date && new Date(c.birth_date+'T00:00:00').getMonth() === idx).length
              const isCurrent = new Date().getMonth() === idx
              return (
                <div key={m} style={{ background: isCurrent ? '#FBF8F0' : '#F9F9F9', borderRadius: 8, padding: '10px 12px', border: isCurrent ? `1px solid ${GOLD}55` : BORDER, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? GOLD : MUTED }}>{m}</div>
                  <div style={{ fontSize: 20, fontFamily: 'var(--font-cormorant), serif', fontWeight: 400, color: TEXT }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
