# SuvarnSetu — Gold Scheme OS

Multi-tenant gold jewellery subscription management platform.

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Auth + Database**: Supabase (PostgreSQL + Row Level Security)
- **Hosting**: Cloudflare Pages
- **Fonts**: Cormorant Garamond + DM Sans

---

## Setup Guide

### 1. Supabase Project
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Copy your **Project URL** and **Anon Key** from Settings → API

### 2. Environment Variables
```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 3. Create Super Admin
In Supabase Dashboard → Authentication → Users → **Add User**:
- Email: `superadmin@yourdomain.com`
- Password: your choice

Then in **SQL Editor**, run:
```sql
-- Replace 'USER_UUID' with the UUID from the Users table
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
WHERE id = 'USER_UUID';
```

### 4. Install and Run
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` → logs in as Super Admin → creates jewellers from the admin panel.

---

## How Multi-Tenancy Works

Every table has a `tenant_id` column.  
Supabase RLS policies enforce:  
```sql
-- Jeweller can only see their own data
USING (tenant_id = auth.current_tenant_id())
```

The `tenant_id` is stored in the user's `app_metadata.tenant_id` JWT claim, injected at login — no subqueries on every request.

---

## Adding a Jeweller (Super Admin Flow)
1. Login as Super Admin
2. Click **Add Jeweller**
3. Fill shop details + admin email/password
4. The system creates:
   - A `tenant` record in the database
   - An auth user with `role: jeweller_admin` + `tenant_id` in `app_metadata`
5. Jeweller logs in at the same URL — sees their own isolated dashboard

---

## Project Structure
```
src/
├── app/
│   ├── login/           # Login page
│   ├── admin/           # Super Admin panel (no sidebar)
│   ├── (jeweller)/      # All jeweller pages (with sidebar)
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── employees/
│   │   ├── daily-dues/
│   │   ├── payments/
│   │   ├── gold-rate/
│   │   ├── closures/
│   │   ├── reports/
│   │   └── settings/
│   └── api/
│       └── admin/       # Server-side admin actions
├── components/
│   └── layout/Sidebar.tsx
├── lib/
│   ├── supabase/        # Browser + server clients
│   └── utils.ts
├── middleware.ts         # Auth guard + license check
└── types/index.ts
```

---

## Deploy to Cloudflare Pages
```bash
npm run build
# Upload dist to Cloudflare Pages
# Set env vars in Cloudflare Pages → Settings → Environment Variables
```

Use **Cloudflare Workers KV** to cache daily gold rates (optional, reduces DB calls).
