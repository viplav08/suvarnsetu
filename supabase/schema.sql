-- ============================================================
-- SuvarnSetu · Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Tenants (one row per jeweller shop)
CREATE TABLE tenants (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id             TEXT UNIQUE NOT NULL,              -- e.g. SHOP-0001
  shop_name           TEXT NOT NULL,
  owner_name          TEXT NOT NULL,
  mobile              TEXT NOT NULL,
  email               TEXT,
  address             TEXT,
  logo_url            TEXT,
  license_start       DATE NOT NULL DEFAULT CURRENT_DATE,
  license_end         DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
  scheme_name         TEXT NOT NULL DEFAULT 'Gold Saving Scheme',
  scheme_duration     INT NOT NULL DEFAULT 11,
  bonus_type          TEXT NOT NULL DEFAULT 'one_month'
                        CHECK (bonus_type IN ('none', 'one_month', 'custom_percentage')),
  bonus_value         NUMERIC DEFAULT 1,
  allow_bonus_toggle  BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE employees (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  employee_id  TEXT NOT NULL,                            -- e.g. EMP-001
  name         TEXT NOT NULL,
  mobile       TEXT NOT NULL,
  role         TEXT DEFAULT 'Sales Executive',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id)
);

-- Customers (subscription members)
CREATE TABLE customers (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id            TEXT NOT NULL,                  -- e.g. CUST-00001
  full_name              TEXT NOT NULL,
  mobile                 TEXT NOT NULL,
  address                TEXT,
  monthly_amount         NUMERIC NOT NULL CHECK (monthly_amount > 0),
  signup_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_day                INT NOT NULL,                   -- derived from signup_date day
  scheme_type            TEXT NOT NULL DEFAULT 'fixed'
                           CHECK (scheme_type IN ('fixed', 'open')),
  scheme_duration_months INT,
  assigned_employee_id   UUID REFERENCES employees(id),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'completed', 'redeemed', 'cancelled')),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, customer_id)
);

-- Payments
CREATE TABLE payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  payment_id      TEXT NOT NULL,                         -- e.g. PAY-000001
  customer_id     UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  months_paid_for INT NOT NULL DEFAULT 1 CHECK (months_paid_for > 0),
  amount_received NUMERIC NOT NULL CHECK (amount_received > 0),
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, payment_id)
);

-- Gold rates (one entry per day per shop)
CREATE TABLE gold_rates (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  rate_22k  NUMERIC NOT NULL CHECK (rate_22k > 0),
  rate_24k  NUMERIC NOT NULL CHECK (rate_24k > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- Account closures
CREATE TABLE account_closures (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id       UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
  closure_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  reason            TEXT NOT NULL CHECK (reason IN ('completed', 'redeemed', 'cancelled')),
  bonus_applied     BOOLEAN DEFAULT FALSE,
  total_amount_paid NUMERIC NOT NULL,
  months_paid       INT NOT NULL,
  final_amount      NUMERIC NOT NULL,
  gold_rate_22k     NUMERIC,
  gold_rate_24k     NUMERIC,
  gold_grams        NUMERIC,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEQUENCE FUNCTIONS (auto-generate IDs)
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS employee_seq START 1;

CREATE OR REPLACE FUNCTION next_customer_id(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('customer_seq');
  RETURN 'CUST-' || LPAD(seq_val::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_payment_id(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('payment_seq');
  RETURN 'PAY-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_employee_id(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('employee_seq');
  RETURN 'EMP-' || LPAD(seq_val::TEXT, 3, '0');
END;
$$;

-- ============================================================
-- HELPER FUNCTION: Get current user's tenant_id from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
$$;

CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_rates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_closures ENABLE ROW LEVEL SECURITY;

-- TENANTS TABLE
CREATE POLICY "super_admin_full_tenants" ON tenants FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_tenant" ON tenants FOR SELECT
  USING (id = auth.current_tenant_id());

CREATE POLICY "jeweller_update_own_tenant" ON tenants FOR UPDATE
  USING (id = auth.current_tenant_id());

-- EMPLOYEES TABLE
CREATE POLICY "super_admin_full_employees" ON employees FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_employees" ON employees FOR ALL
  USING (tenant_id = auth.current_tenant_id());

-- CUSTOMERS TABLE
CREATE POLICY "super_admin_full_customers" ON customers FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_customers" ON customers FOR ALL
  USING (tenant_id = auth.current_tenant_id());

-- PAYMENTS TABLE
CREATE POLICY "super_admin_full_payments" ON payments FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_payments" ON payments FOR ALL
  USING (tenant_id = auth.current_tenant_id());

-- GOLD RATES TABLE
CREATE POLICY "super_admin_full_gold_rates" ON gold_rates FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_gold_rates" ON gold_rates FOR ALL
  USING (tenant_id = auth.current_tenant_id());

-- ACCOUNT CLOSURES TABLE
CREATE POLICY "super_admin_full_closures" ON account_closures FOR ALL
  USING (auth.current_role() = 'super_admin');

CREATE POLICY "jeweller_own_closures" ON account_closures FOR ALL
  USING (tenant_id = auth.current_tenant_id());

-- ============================================================
-- INDEXES (critical for performance with RLS)
-- ============================================================

CREATE INDEX idx_customers_tenant        ON customers(tenant_id);
CREATE INDEX idx_customers_status        ON customers(tenant_id, status);
CREATE INDEX idx_customers_due_day       ON customers(tenant_id, due_day);
CREATE INDEX idx_payments_tenant         ON payments(tenant_id);
CREATE INDEX idx_payments_customer       ON payments(customer_id);
CREATE INDEX idx_payments_date           ON payments(tenant_id, payment_date);
CREATE INDEX idx_gold_rates_tenant_date  ON gold_rates(tenant_id, date DESC);
CREATE INDEX idx_employees_tenant        ON employees(tenant_id);
CREATE INDEX idx_closures_tenant         ON account_closures(tenant_id);
CREATE INDEX idx_closures_customer       ON account_closures(customer_id);

-- ============================================================
-- HOW TO CREATE USERS (run these from your backend/server only)
-- ============================================================
-- 
-- 1. Create Super Admin (run once):
--    In Supabase Dashboard → Authentication → Users → Add User
--    Then set app_metadata via service role:
--
--    await supabase.auth.admin.updateUserById(userId, {
--      app_metadata: { role: 'super_admin' }
--    })
--
-- 2. When super admin creates a jeweller:
--    a. Insert into tenants table
--    b. Create auth user:
--       await supabase.auth.admin.createUser({
--         email: 'admin@shop.com',
--         password: 'temp_password',
--         app_metadata: {
--           role: 'jeweller_admin',
--           tenant_id: '<tenant_uuid>'
--         }
--       })
--
-- ============================================================
