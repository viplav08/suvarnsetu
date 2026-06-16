'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C09428', TEXT = '#1A1008', MUTED = '#7A6A5A', BORDER = '1px solid #E5DDD0'
const GREEN = '#1A7A3A', RED = '#C03030'

const TEMPLATE_HEADERS = ['full_name', 'mobile', 'monthly_amount', 'signup_date', 'months_paid', 'whatsapp', 'birth_date', 'anniversary_date', 'address', 'scheme_duration']
const SAMPLE_ROW       = ['Ramesh Shukla', '9876543210', '1000', '01/06/2025', '3', '', '15/08/1985', '', 'Shop 4 Main Bazaar', '11']

function parseDate(val: string): string | null {
  if (!val?.trim()) return null
  // DD/MM/YYYY
  const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim()
  return null
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  }).filter(r => r.full_name || r.mobile)
}

export default function BulkUploadModal({ tenantId, onClose, onDone }: { tenantId: string; onClose: () => void; onDone: () => void }) {
  const supabase = createClient()
  const [step, setStep]         = useState<'upload'|'preview'|'processing'|'done'>('upload')
  const [rows, setRows]         = useState<Record<string, string>[]>([])
  const [results, setResults]   = useState<{ name: string; status: 'ok'|'error'; msg: string }[]>([])
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  function downloadTemplate() {
    const csv = [TEMPLATE_HEADERS.join(','), SAMPLE_ROW.join(',')].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'suvarnsetu_import_template.csv'
    a.click()
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parseCsv(e.target?.result as string)
      setRows(parsed); setStep('preview')
    }
    reader.readAsText(file)
  }

  async function processImport() {
    setStep('processing'); setProgress(0)
    const res: { name: string; status: 'ok'|'error'; msg: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = row.full_name?.trim()
      const mobile = row.mobile?.trim()
      const amount = parseFloat(row.monthly_amount)
      const signupDate = parseDate(row.signup_date)

      // Validate mandatory fields
      if (!name)        { res.push({ name: `Row ${i+2}`, status: 'error', msg: 'Missing full_name' }); continue }
      if (!mobile || !/^\d{10}$/.test(mobile)) { res.push({ name, status: 'error', msg: 'Invalid mobile (must be 10 digits)' }); continue }
      if (isNaN(amount) || amount <= 0) { res.push({ name, status: 'error', msg: 'Invalid monthly_amount' }); continue }
      if (!signupDate)  { res.push({ name, status: 'error', msg: 'Invalid signup_date (use DD/MM/YYYY)' }); continue }

      try {
        // 1. Upsert customer (mobile = unique per tenant)
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('mobile', mobile)
          .maybeSingle()

        let customerId = existing?.id
        if (!customerId) {
          // Generate customer_id
          const { data: countData } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
          const count = (countData as any)?.length ?? 0

          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert({
              tenant_id:         tenantId,
              customer_id:       `CUST-${String(count + 1).padStart(5, '0')}`,
              full_name:         name,
              mobile,
              whatsapp:          row.whatsapp?.trim() || mobile,
              birth_date:        parseDate(row.birth_date),
              anniversary_date:  parseDate(row.anniversary_date),
              address:           row.address?.trim() || null,
              status:            'active',
            })
            .select('id')
            .single()
          if (custErr) throw new Error(custErr.message)
          customerId = newCust.id
        }

        // 2. Check if enrollment already exists for this customer
        const { data: existingEnr } = await supabase
          .from('enrollments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId)
          .eq('status', 'active')
          .maybeSingle()

        if (existingEnr) {
          res.push({ name, status: 'ok', msg: 'Customer exists — enrollment skipped (already active)' })
          setProgress(Math.round(((i + 1) / rows.length) * 100))
          continue
        }

        // 3. Create enrollment
        const signupDateObj = new Date(signupDate + 'T00:00:00')
        const dueDay = signupDateObj.getDate()
        const duration = parseInt(row.scheme_duration) || 11

        const { data: enrCount } = await supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        const enrNum = (enrCount as any)?.length ?? 0

        const { data: newEnr, error: enrErr } = await supabase
          .from('enrollments')
          .insert({
            tenant_id:              tenantId,
            customer_id:            customerId,
            enrollment_id:          `ENR-${String(enrNum + 1).padStart(5, '0')}`,
            monthly_amount:         amount,
            signup_date:            signupDate,
            due_day:                dueDay,
            scheme_type:            'fixed',
            scheme_duration_months: duration,
            status:                 'active',
          })
          .select('id')
          .single()
        if (enrErr) throw new Error(enrErr.message)

        // 4. Insert historical payments if months_paid > 0
        const monthsPaid = parseInt(row.months_paid) || 0
        if (monthsPaid > 0 && newEnr) {
          const paymentRows = []
          const { data: payCount } = await supabase
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
          let payNum = (payCount as any)?.length ?? 0

          for (let m = 0; m < monthsPaid; m++) {
            const payDate = new Date(signupDateObj.getFullYear(), signupDateObj.getMonth() + m, dueDay)
            paymentRows.push({
              tenant_id:      tenantId,
              customer_id:    customerId,
              enrollment_id:  newEnr.id,
              payment_id:     `PAY-${String(++payNum).padStart(6, '0')}`,
              amount_received: amount,
              payment_date:   payDate.toISOString().split('T')[0],
              months_paid_for: 1,
              payment_mode:   'cash',
              notes:          'Imported via bulk upload',
            })
          }
          await supabase.from('payments').insert(paymentRows)
        }

        res.push({ name, status: 'ok', msg: `Enrolled · ${monthsPaid} months imported` })
      } catch (err: any) {
        res.push({ name, status: 'error', msg: err.message ?? 'Unknown error' })
      }

      setProgress(Math.round(((i + 1) / rows.length) * 100))
      await new Promise(r => setTimeout(r, 80)) // small delay to avoid rate limits
    }

    setResults(res); setStep('done')
  }

  const ok  = results.filter(r => r.status === 'ok').length
  const err = results.filter(r => r.status === 'error').length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: BORDER }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 22, fontWeight: 600, color: TEXT }}>
              {step === 'upload' ? 'Bulk Import Customers' : step === 'preview' ? `Preview — ${rows.length} rows` : step === 'processing' ? 'Importing...' : 'Import Complete'}
            </h2>
            {step === 'upload' && <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>Upload a CSV file to import all your existing customers at once</p>}
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: MUTED }}>×</button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Template download */}
              <div style={{ background: '#FBF8F0', border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 4 }}>📄 Step 1 — Download Template</div>
                  <div style={{ fontSize: 12, color: MUTED }}>Fill in the CSV with your customer data and upload below</div>
                </div>
                <button onClick={downloadTemplate}
                  style={{ background: GOLD, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                  ↓ Template
                </button>
              </div>

              {/* Mandatory/Optional fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#FEF9E0', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#856404', marginBottom: 8 }}>✱ MANDATORY FIELDS</div>
                  {[['full_name', 'Customer full name'],['mobile','10-digit mobile'],['monthly_amount','SIP amount (₹)'],['signup_date','DD/MM/YYYY']].map(([f,d]) => (
                    <div key={f} style={{ fontSize: 12, marginBottom: 4 }}><code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>{f}</code><span style={{ color: MUTED, marginLeft: 6 }}>{d}</span></div>
                  ))}
                </div>
                <div style={{ background: '#F0FFF4', border: '1px solid #6EC68A', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: GREEN, marginBottom: 8 }}>◎ OPTIONAL (leave blank)</div>
                  {[['months_paid','Months already paid'],['whatsapp','WhatsApp number'],['birth_date','DOB DD/MM/YYYY'],['anniversary_date','Anniv. DD/MM/YYYY'],['address','Address'],['scheme_duration','6/11/24/36']].map(([f,d]) => (
                    <div key={f} style={{ fontSize: 12, marginBottom: 4 }}><code style={{ background: '#D1FAE5', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: 11 }}>{f}</code><span style={{ color: MUTED, marginLeft: 6 }}>{d}</span></div>
                  ))}
                </div>
              </div>

              {/* File drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f) }}
                style={{ border: `2px dashed ${dragOver ? GOLD : '#E5DDD0'}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#FBF8F0' : '#FAFAFA', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Step 2 — Upload your filled CSV</div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>Drag & drop here, or click to browse</div>
                <label style={{ background: GOLD, color: '#fff', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Choose CSV File
                  <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f) }} />
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div>
              <div style={{ background: '#F0FFF4', border: '1px solid #6EC68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: GREEN, fontWeight: 600 }}>
                ✓ {rows.length} customers found in file — review below then click Import
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', border: BORDER, borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#F9F7F3', position: 'sticky', top: 0 }}>
                      {['Name','Mobile','Amount','Signup','Paid Months'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: MUTED, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: BORDER }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F5F0E6' }}>
                        <td style={{ padding: '8px 12px', color: TEXT, fontWeight: 600 }}>{row.full_name || <span style={{ color: RED }}>MISSING</span>}</td>
                        <td style={{ padding: '8px 12px', color: MUTED }}>{row.mobile || <span style={{ color: RED }}>MISSING</span>}</td>
                        <td style={{ padding: '8px 12px', color: GOLD, fontWeight: 700 }}>₹{row.monthly_amount}</td>
                        <td style={{ padding: '8px 12px', color: MUTED }}>{row.signup_date}</td>
                        <td style={{ padding: '8px 12px', color: MUTED, textAlign: 'center' }}>{row.months_paid || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={() => setStep('upload')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 14 }}>← Back</button>
                <button onClick={processImport} style={{ flex: 2, background: GOLD, color: '#fff', border: 'none', padding: '11px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  Import {rows.length} Customers →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Processing */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 20, fontWeight: 400, color: TEXT, marginBottom: 16 }}>Importing customers...</div>
              <div style={{ height: 12, background: '#F0EAE0', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: GOLD, borderRadius: 10, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 14, color: MUTED }}>{progress}% complete</div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: '#F0FFF4', border: '1px solid #6EC68A', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: 'var(--font-cormorant), serif', color: GREEN, fontWeight: 400 }}>{ok}</div>
                  <div style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginTop: 4 }}>✓ Imported Successfully</div>
                </div>
                <div style={{ background: err > 0 ? '#FEE2E2' : '#F9F7F3', border: `1px solid ${err > 0 ? '#FECACA' : '#E5DDD0'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: 'var(--font-cormorant), serif', color: err > 0 ? RED : MUTED, fontWeight: 400 }}>{err}</div>
                  <div style={{ fontSize: 12, color: err > 0 ? RED : MUTED, fontWeight: 700, marginTop: 4 }}>{err > 0 ? '✗ Errors' : '✓ No Errors'}</div>
                </div>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto', border: BORDER, borderRadius: 10 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid #F5F0E6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.name}</span>
                    <span style={{ fontSize: 12, color: r.status === 'ok' ? GREEN : RED, textAlign: 'right' }}>
                      {r.status === 'ok' ? '✓' : '✗'} {r.msg}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, border: BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 14 }}>Close</button>
                <button onClick={() => { onDone(); onClose() }} style={{ flex: 2, background: '#1B1108', color: '#fff', border: 'none', padding: '11px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  ✓ View Customers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
