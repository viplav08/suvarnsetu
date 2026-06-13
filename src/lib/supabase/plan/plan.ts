// src/lib/plan.ts
// Central plan feature gate — imported by every page that needs it

export type Plan = 'trial' | 'starter' | 'growth' | 'professional'

export const PLAN_LIMITS = {
  trial:        { enrollments: 999999, managers: 10, label: 'Free Trial' },
  starter:      { enrollments: 100,    managers: 1,  label: 'Starter' },
  growth:       { enrollments: 300,    managers: 3,  label: 'Growth' },
  professional: { enrollments: 999999, managers: 10, label: 'Professional' },
}

export const PLAN_FEATURES: Record<string, Plan[]> = {
  reports:     ['trial', 'growth', 'professional'],
  crm:         ['trial', 'growth', 'professional'],
  dataExport:  ['trial', 'growth', 'professional'],
  closures:    ['trial', 'starter', 'growth', 'professional'],
  employees:   ['trial', 'starter', 'growth', 'professional'],
  multipleManagers: ['trial', 'growth', 'professional'],
}

export function canAccess(feature: keyof typeof PLAN_FEATURES, plan: Plan): boolean {
  return PLAN_FEATURES[feature]?.includes(plan) ?? true
}

export function enrollmentLimit(plan: Plan): number {
  return PLAN_LIMITS[plan]?.enrollments ?? 100
}

export function managerLimit(plan: Plan): number {
  return PLAN_LIMITS[plan]?.managers ?? 1
}

export function planLabel(plan: Plan): string {
  return PLAN_LIMITS[plan]?.label ?? 'Unknown'
}

export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) < new Date()
}

export function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000)
}

export const UPGRADE_COPY: Record<string, { title: string; description: string; requiredPlan: string }> = {
  reports: {
    title: 'Unlock Full Reports',
    description: 'Monthly forecast, overdue analysis, payment history and more.',
    requiredPlan: 'Growth',
  },
  crm: {
    title: 'Unlock CRM & Birthday Wishes',
    description: 'Automatically track birthdays, anniversaries and send wishes.',
    requiredPlan: 'Growth',
  },
  dataExport: {
    title: 'Unlock Data Export',
    description: 'Download all your customer and payment data as CSV files.',
    requiredPlan: 'Growth',
  },
}
