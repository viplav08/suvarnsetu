import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const CUSTOMERS = [
  { full_name: 'Ramesh Shukla',      mobile: '9876543210', birth_date: '1978-03-15', anniversary_date: '2003-11-20' },
  { full_name: 'Sunita Patil',       mobile: '9765432109', birth_date: '1985-07-22', anniversary_date: null },
  { full_name: 'Mahesh Desai',       mobile: '9654321098', birth_date: '1972-12-08', anniversary_date: '1998-02-14' },
  { full_name: 'Priya Mehta',        mobile: '9543210987', birth_date: '1990-05-30', anniversary_date: null },
  { full_name: 'Suresh Nair',        mobile: '9432109876', birth_date: '1968-09-12', anniversary_date: '1995-06-05' },
  { full_name: 'Kavita Sharma',      mobile: '9321098765', birth_date: '1982-01-18', anniversary_date: '2008-04-25' },
  { full_name: 'Dinesh Joshi',       mobile: '9210987654', birth_date: '1975-08-03', anniversary_date: '2001-12-10' },
  { full_name: 'Anita Kulkarni',     mobile: '9109876543', birth_date: '1988-04-20', anniversary_date: null },
  { full_name: 'Vijay Sawant',       mobile: '9098765432', birth_date: '1970-11-25', anniversary_date: '1996-03-08' },
  { full_name: 'Geeta Pandey',       mobile: '9987654321', birth_date: '1993-06-14', anniversary_date: null },
  { full_name: 'Arun Krishnamurthy', mobile: '8876543210', birth_date: '1965-02-28', anniversary_date: '1992-07-15' },
  { full_name: 'Meera Iyer',         mobile: '8765432109', birth_date: '1980-10-05', anniversary_date: '2007-09-20' },
]

const MONTHLY_AMOUNTS = [500, 1000, 1000, 1500, 2000, 2000, 2500, 3000, 1000, 500, 1500, 2000]

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate())
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export async function POST(req: Request) {
  try {
    const { tenant_id } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 })

    const admin   = createAdminClient()
    const today   = new Date(); today.setHours(0,0,0,0)

    // ── 1. Check existing data ──────────────────────────────────────
    const { count } = await admin.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'This account already has data. Demo data only loads on empty accounts.' }, { status: 400 })

    // ── 2. Get sequences ────────────────────────────────────────────
    const { data: custSeq }  = await admin.rpc('next_customer_id',   { p_tenant_id: tenant_id })
    // We'll insert customers one by one to get sequential IDs

    // ── 3. Insert customers ─────────────────────────────────────────
    const custIds: string[] = []
    for (let i = 0; i < CUSTOMERS.length; i++) {
      const { data: cid } = await admin.rpc('next_customer_id', { p_tenant_id: tenant_id })
      const cu = CUSTOMERS[i]
      const { data: newCust, error } = await admin.from('customers').insert({
        tenant_id,
        customer_id:      cid,
        full_name:        cu.full_name,
        mobile:           cu.mobile,
        birth_date:       cu.birth_date,
        anniversary_date: cu.anniversary_date,
        is_subscriber:    true,
        monthly_amount:   0,
        status:           'active',
        scheme_type:      'fixed',
        signup_date:      toDateStr(addMonths(today, -6)),
        due_day:          1,
      }).select('id').single()
      if (error) console.error('Customer insert error:', error.message)
      else custIds.push(newCust.id)
    }

    // ── 4. Insert enrollments ───────────────────────────────────────
    const enrollmentIds: { id: string; uuid: string; signupDate: Date; monthlyAmount: number; paidMonths: number }[] = []

    // 10 active, 2 closed
    const signupOffsets = [-6, -5, -5, -4, -4, -3, -3, -2, -2, -1, -8, -7]
    const paidPattern   = [6, 5, 3, 4, 2, 3, 0, 2, 1, 0, 8, 7] // some overdue, some current

    for (let i = 0; i < custIds.length; i++) {
      const { data: eid } = await admin.rpc('next_enrollment_id', { p_tenant_id: tenant_id })
      const signupDate  = addMonths(today, signupOffsets[i])
      const isActive    = i < 10
      const { data: en, error } = await admin.from('enrollments').insert({
        tenant_id,
        enrollment_id:          eid,
        customer_id:            custIds[i],
        monthly_amount:         MONTHLY_AMOUNTS[i],
        signup_date:            toDateStr(signupDate),
        due_day:                signupDate.getDate() > 28 ? 1 : signupDate.getDate(),
        scheme_type:            'fixed',
        scheme_duration_months: 11,
        status:                 isActive ? 'active' : 'completed',
      }).select('id').single()
      if (!error && en) {
        enrollmentIds.push({ id: eid, uuid: en.id, signupDate, monthlyAmount: MONTHLY_AMOUNTS[i], paidMonths: paidPattern[i] })
      }
    }

    // ── 5. Insert payments ──────────────────────────────────────────
    for (let i = 0; i < enrollmentIds.length; i++) {
      const en = enrollmentIds[i]
      for (let m = 0; m < en.paidMonths; m++) {
        const { data: pid } = await admin.rpc('next_payment_id', { p_tenant_id: tenant_id })
        const payDate = addMonths(en.signupDate, m)
        payDate.setDate(payDate.getDate() + Math.floor(Math.random() * 5))
        await admin.from('payments').insert({
          tenant_id,
          payment_id:      pid,
          enrollment_id:   en.uuid,
          customer_id:     custIds[i],
          payment_date:    toDateStr(payDate),
          months_paid_for: 1,
          amount_received: en.monthlyAmount,
          payment_mode:    ['cash','upi','upi','cash','bank_transfer'][Math.floor(Math.random()*5)],
        })
      }
    }

    // ── 6. Insert closures for last 2 enrollments ───────────────────
    for (let i = 10; i < Math.min(12, enrollmentIds.length); i++) {
      const en = enrollmentIds[i]
      const totalPaid = en.paidMonths * en.monthlyAmount
      await admin.from('account_closures').insert({
        tenant_id,
        customer_id:      custIds[i],
        enrollment_id:    en.uuid,
        closure_date:     toDateStr(addMonths(today, -1)),
        reason:           i === 10 ? 'completed' : 'cancelled',
        months_paid:      en.paidMonths,
        total_amount_paid: totalPaid,
        bonus_applied:    i === 10,
        final_amount:     i === 10 ? totalPaid + en.monthlyAmount : totalPaid,
      })
    }

    // ── 7. Insert gold rates (last 90 days) ─────────────────────────
    const baseRate22k = 6200, baseRate24k = 6780
    for (let d = 90; d >= 0; d -= 3) {
      const rateDate = new Date(today); rateDate.setDate(rateDate.getDate() - d)
      const variance = Math.floor(Math.random() * 300) - 100
      await admin.from('gold_rates').insert({
        tenant_id,
        date:      toDateStr(rateDate),
        rate_22k:  baseRate22k + variance + Math.floor(d * 2),
        rate_24k:  baseRate24k + variance + Math.floor(d * 2),
      }).select()
    }

    // ── 8. Insert sample follow-up notes ───────────────────────────
    if (enrollmentIds.length > 0) {
      const remarks = [
        { remark: 'Called customer, said will pay by end of week', followed_by: 'Admin', days: -5, next: 7 },
        { remark: 'Customer visited shop, asked for 2 more days', followed_by: 'Admin', days: -2, next: 3 },
        { remark: 'No response on call, will try again tomorrow', followed_by: 'Admin', days: -1, next: 1 },
      ]
      const overdueEnrollments = enrollmentIds.filter((_, i) => paidPattern[i] < signupOffsets[i] * -1 - 1)
      for (let i = 0; i < Math.min(3, overdueEnrollments.length); i++) {
        const r = remarks[i]
        const remarkDate = new Date(today); remarkDate.setDate(remarkDate.getDate() + r.days)
        const nextDate   = new Date(today); nextDate.setDate(nextDate.getDate() + r.next)
        await admin.from('follow_ups').insert({
          tenant_id,
          enrollment_id:      overdueEnrollments[i].uuid,
          remark:             r.remark,
          followed_by:        r.followed_by,
          remark_date:        toDateStr(remarkDate),
          next_followup_date: toDateStr(nextDate),
        })
      }
    }

    return NextResponse.json({ success: true, customers: custIds.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
