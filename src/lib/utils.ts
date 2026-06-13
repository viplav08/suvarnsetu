// Format currency in Indian format
export function formatINR(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN')
}

// Format date as "04 May 2026"
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Get day of month from a date string
export function getDueDay(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDate()
}

// Calculate pending dues for a customer
export function calcPendingDues(
  customer: { signup_date: string; monthly_amount: number },
  totalMonthsPaid: number,
  today = new Date()
) {
  const signup = new Date(customer.signup_date + 'T00:00:00')
  const dueDay = signup.getDate()

  // Count all due dates from signup to today
  const dueDates: Date[] = []
  let cursor = new Date(signup)
  while (cursor <= today) {
    dueDates.push(new Date(cursor))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dueDay)
  }

  const dueCount = dueDates.length
  const pending = Math.max(0, dueCount - totalMonthsPaid)
  const isDueToday =
    dueDay === today.getDate() &&
    dueDates.some(
      (d) =>
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
    ) &&
    pending > 0

  const pastDates = dueDates.filter((d) => d < today)
  const overdueMonths = Math.max(0, pastDates.length - totalMonthsPaid)

  return {
    dueCount,
    pending,
    pendingAmount: pending * customer.monthly_amount,
    isDueToday,
    isOverdue: overdueMonths > 0,
    overdueMonths,
  }
}

// Check if license is expired
export function isLicenseExpired(licenseEnd: string): boolean {
  return new Date(licenseEnd + 'T23:59:59') < new Date()
}

// Today as YYYY-MM-DD
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
