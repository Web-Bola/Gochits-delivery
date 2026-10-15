# Gochit's Delivery

Food delivery platform for the Gochit's burger brand (Georgia). **6 branches from launch, each with its own delivery zones.**
Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (draft v0.2). Design reference: [docs/DESIGN_HANDOFF.md](docs/DESIGN_HANDOFF.md) and `design/`.

## Status
| Part | State |
|---|---|
| `supabase/` schema, RLS, `resolve_branches`, `create_order`, `transition_order` | done, SQL tests pass |
| `packages/shared`, `i18n`, `ui-tokens` | done, unit tests pass |
| `apps/customer-app` (Expo): login (phone OTP) → address → branch pick → menu → cart → checkout → order status | first slice, typechecks, **not yet run on a device** |
| Card payments | not built (provider undecided) |
| Courier app, restaurant dashboard, admin dashboard | not started |

## Not invented
Branch names/addresses/phones, zone shapes and fees, opening hours, approved prices and the payment provider are **unknown**. `seed.sql` has 6 placeholder branches (`accepts_orders=false`) and the Wolt-observed menu marked `price_source='unapproved'`. A branch cannot take orders until an admin sets zones with a fee and enables it.

## Run
```bash
pnpm install
pnpm test && pnpm typecheck
# database checks (needs Postgres + PostGIS):
PGHOST=localhost PGUSER=postgres supabase/tests/run-tests.sh
# app:
cp .env.example apps/customer-app/.env   # fill Supabase URL + anon key
pnpm --filter @gochits/customer-app start
```
Supabase project setup: apply `supabase/migrations/*.sql` in order, then `supabase/seed.sql`; enable Phone auth with an SMS provider. Never put the service-role key in an app.

## Rules
- Money is integer tetri. Totals, fees and discounts are computed only in the database (`create_order`).
- Tables `orders`, `order_items`, `order_events` accept no direct writes; only the SECURITY DEFINER functions.
- All UI text is Georgian, in `packages/i18n`.

## Demo mode (for showing the app to the restaurant)
Run `supabase/migrations/0004_demo_mode.sql` in the Supabase SQL Editor, then switch demo on:
`update app_settings set value='true' where key='demo_mode';`
Switch it off before any real launch: `update app_settings set value='false' where key='demo_mode';`
Demo mode simulates card payment and order progress on the server. No card data is collected anywhere. Real payment is not built (provider undecided).
