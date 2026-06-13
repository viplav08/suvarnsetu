export type UserRole = 'super_admin' | 'jeweller_admin' | 'employee'

export interface Tenant {
  id: string
  shop_id: string
  shop_name: string
  owner_name: string
  mobile: string
  email: string
  address: string
  logo_url: string
  license_start: string
  license_end: string
  status: 'active' | 'inactive'
  scheme_name: string
  scheme_duration: number
  bonus_type: 'none' | 'one_month' | 'custom_percentage'
  bonus_value: number
  allow_bonus_toggle: boolean
  created_at: string
}

export interface Employee {
  id: string
  tenant_id: string
  employee_id: string
  name: string
  mobile: string
  role: string
  created_at: string
}

export interface Customer {
  id: string
  tenant_id: string
  customer_id: string
  full_name: string
  mobile: string
  address: string
  monthly_amount: number
  signup_date: string
  due_day: number
  scheme_type: 'fixed' | 'open'
  scheme_duration_months: number | null
  assigned_employee_id: string | null
  status: 'active' | 'completed' | 'redeemed' | 'cancelled'
  created_at: string
  employees?: { name: string } | null
}

export interface Payment {
  id: string
  tenant_id: string
  payment_id: string
  customer_id: string
  payment_date: string
  months_paid_for: number
  amount_received: number
  remarks: string
  created_at: string
  customers?: { full_name: string; customer_id: string } | null
}

export interface GoldRate {
  id: string
  tenant_id: string
  date: string
  rate_22k: number
  rate_24k: number
  created_at: string
}

export interface AccountClosure {
  id: string
  tenant_id: string
  customer_id: string
  closure_date: string
  reason: 'completed' | 'redeemed' | 'cancelled'
  bonus_applied: boolean
  total_amount_paid: number
  months_paid: number
  final_amount: number
  gold_rate_22k: number
  gold_rate_24k: number
  gold_grams: number
  notes: string
  created_at: string
  customers?: { full_name: string; customer_id: string; monthly_amount: number } | null
}

export interface DueInfo {
  customer: Customer
  pendingMonths: number
  pendingAmount: number
  isDueToday: boolean
  isOverdue: boolean
}
