# Gochit's dashboard (admin now, restaurant panel next)

Next.js app on the same Supabase project. `/admin/*` is for super admins only (checked in the browser **and** by database RLS / function checks).
The restaurant (branch) panel will be added as `/restaurant/*` in this same app.

## Setup
1. Run `supabase/migrations/0007_admin_panel.sql` in the Supabase SQL Editor.
2. Supabase → Authentication → Users → **Add user** (email + password, tick "Auto confirm").
3. Make that user an admin (SQL Editor): `update profiles set role = 'super_admin' where id = (select id from auth.users where email = 'YOUR@EMAIL');`
4. `cp .env.example .env.local` and fill in the URL and the **publishable** key (never the secret key).
5. `pnpm install` then `pnpm dev` → http://localhost:3000

## Pages
Home (launch-readiness + sales report) · Branches (address, phone, coordinates, weekly hours, accept orders) · Zones (circle + fee, min order, free-from, extra minutes) · Products (prices, approve prices, categories, per-branch availability) · Promo codes · Settings (demo mode).
