'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

export default function ClosurePrintPage() {
  const supabase = createClient()
  const { id }   = useParams()
  const [data,   setData]   = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const tenantId = user.app_metadata?.tenant_id

      const [{ data: cl }, { data: t }] = await Promise.all([
        supabase.from('account_closures')
          .select('*, enrollments(enrollment_id, monthly_amount, signup_date, scheme_duration_months, customers(full_name, customer_id, mobile, address))')
          .eq('id', id as string)
          .single(),
        supabase.from('tenants')
          .select('shop_name, owner_name, mobile, address, city, gstin, scheme_name')
          .eq('id', tenantId)
          .single(),
      ])
      setData(cl); setTenant(t); setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Georgia, serif', color: '#7A6A5A' }}>Loading certificate…</div>
  if (!data)   return <div style={{ padding: 40, textAlign: 'center' }}>Certificate not found.</div>

  const FD = (d: string) => !d ? '—' : new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const INR = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN')

  const enrollment = data.enrollments
  const customer   = enrollment?.customers
  const reasonMap: Record<string, string> = {
    completed: 'Scheme Completion',
    cancelled:  'Early Foreclosure',
    redeemed:   'Early Redemption',
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; background: white !important; }
          .no-print { display: none !important; }
          aside { display: none !important; }
          nav   { display: none !important; }
          /* Hide trial banner and any flex wrappers — show only certificate */
          body > div > div > div:not(#certificate-wrapper) { display: none !important; }
          #certificate-wrapper { display: block !important; }
          @page { margin: 10mm; size: A4; }
        }
        body { font-family: Georgia, serif; background: #F5F0E6; }
      `}</style>

      {/* Print button */}
      <div className="no-print" style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 10, zIndex: 99 }}>
        <button onClick={() => {
            // Hide sidebar and trial banner before printing
            document.querySelectorAll('aside, [data-trial-banner]').forEach((el: any) => { el.style.display = 'none' })
            setTimeout(() => {
              window.print()
              // Restore after print dialog closes
              setTimeout(() => document.querySelectorAll('aside, [data-trial-banner]').forEach((el: any) => { el.style.display = '' }), 500)
            }, 100)
          }}
          style={{ background: '#C09428', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          🖨 Print / Save PDF
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#fff', color: '#7A6A5A', border: '1px solid #E5DDD0', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Close
        </button>
      </div>

      {/* Certificate */}
      <div id="certificate-wrapper" style={{ maxWidth: 720, margin: '40px auto', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.10)' }}>

        {/* Gold top border */}
        <div style={{ height: 8, background: 'linear-gradient(90deg, #C09428, #E8C566, #C09428)' }} />

        <div style={{ padding: '36px 48px' }}>

          {/* Shop header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #E5DDD0' }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, color: '#1A1008', letterSpacing: 0.5 }}>
                {tenant?.shop_name ?? 'Jewellers'}
              </div>
              <div style={{ fontSize: 12, color: '#7A6A5A', marginTop: 4, lineHeight: 1.7 }}>
                {tenant?.address && <div>{tenant.address}{tenant.city ? `, ${tenant.city}` : ''}</div>}
                {tenant?.mobile && <div>📞 {tenant.mobile}</div>}
                {tenant?.gstin  && <div>GSTIN: {tenant.gstin}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A6A5A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Certificate No.</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1008' }}>{enrollment?.enrollment_id}</div>
              <div style={{ fontSize: 11, color: '#7A6A5A', marginTop: 4 }}>Date: {FD(data.closure_date)}</div>
            </div>
          </div>

          {/* Certificate title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7A6A5A', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>
              {tenant?.scheme_name ?? 'Gold Saving Scheme'}
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, color: '#1A1008', letterSpacing: 1 }}>
              {reasonMap[data.reason] ?? 'Account Certificate'}
            </div>
            <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #C09428, transparent)', margin: '12px auto', width: 200 }} />
          </div>

          {/* Certified text */}
          <div style={{ textAlign: 'center', fontSize: 13.5, color: '#1A1008', lineHeight: 1.8, marginBottom: 28 }}>
            This is to certify that
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400, color: '#1A1008', margin: '8px 0' }}>
              {customer?.full_name}
            </div>
            <span style={{ fontSize: 12, color: '#7A6A5A' }}>
              Customer ID: {customer?.customer_id} · {customer?.mobile}
            </span>
          </div>

          {/* Details grid */}
          <div style={{ background: '#FBF8F0', borderRadius: 10, border: '1px solid #E5DDD0', padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[
                ['Enrollment ID',     enrollment?.enrollment_id],
                ['Scheme',            tenant?.scheme_name ?? 'Gold Saving Scheme'],
                ['Monthly Amount',    INR(enrollment?.monthly_amount)],
                ['Start Date',        FD(enrollment?.signup_date)],
                ['Closure Date',      FD(data.closure_date)],
                ['Months Completed',  `${data.months_paid} months`],
                ['Total Paid',        INR(data.total_amount_paid)],
                ['Bonus Applied',     data.bonus_applied ? INR(data.final_amount - data.total_amount_paid) : 'Not applicable'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7A6A5A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1008' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Final amount highlight */}
          <div style={{ background: '#1B1108', borderRadius: 10, padding: '18px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Final Payable Amount</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400, color: '#C09428' }}>{INR(data.final_amount)}</div>
          </div>

          {/* Signature */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32, paddingTop: 20, borderTop: '1px solid #E5DDD0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 40, borderBottom: '1px solid #1A1008', marginBottom: 6 }}></div>
              <div style={{ fontSize: 12, color: '#7A6A5A' }}>Customer Signature</div>
              <div style={{ fontSize: 11.5, color: '#1A1008', marginTop: 2 }}>{customer?.full_name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 40, borderBottom: '1px solid #1A1008', marginBottom: 6 }}></div>
              <div style={{ fontSize: 12, color: '#7A6A5A' }}>Authorised Signatory</div>
              <div style={{ fontSize: 11.5, color: '#1A1008', marginTop: 2 }}>{tenant?.shop_name}</div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ background: '#FBF8F0', padding: '12px 48px', borderTop: '1px solid #E5DDD0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#7A6A5A' }}>
            Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 10.5, color: '#7A6A5A' }}>
            Powered by <strong style={{ color: '#C09428' }}>SuvarnSetu</strong> · comedgelabs.com
          </div>
        </div>

        {/* Gold bottom border */}
        <div style={{ height: 6, background: 'linear-gradient(90deg, #C09428, #E8C566, #C09428)' }} />
      </div>
    </>
  )
}
