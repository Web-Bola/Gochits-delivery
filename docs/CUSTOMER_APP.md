# Customer app: status (2026-10-16)

Expo / React Native app in `apps/customer-app`. All text is Georgian (`packages/i18n`). Money is integer tetri; the server computes every price.

## What the customer can do
- Sign in with a phone number (SMS code). No address is asked at sign-in.
- Pick a branch (list with open/closed state, or "nearest" through delivery zones). The menu, prices and sold-out items follow the branch. Switching branch with a non-empty cart asks first and clears the cart.
- Menu: discount carousel, filters (discounts, spicy, price), search, category tabs that follow the scroll, sold-out items shown but not orderable, favorites (heart), quantity badge on cards, animated cart bar.
- Product page: photo, remove-ingredient options, add-ons (sauces, sides, drinks), comment. Notes travel with the order line.
- Cart: stored on the device (survives closing the app), today's prices re-applied, "add more" suggestions, promo code (server validated), clear cart.
- Checkout: saved addresses or a new one (device location + street text), server check of the zone / minimum / fee / opening hours, other branch suggested when the chosen one does not deliver there, card (demo) or cash (only where the branch allows it).
- Tracking: live status (realtime + 4 s polling fallback), cancel before the restaurant accepts and before any card money is taken, call the branch, rating after delivery.
- Orders: active and past, reorder at current prices (unavailable items are listed, not silently dropped).
- Profile: name, favorites, addresses, support phone, legal pages, log out, **delete account** (required by the stores).
- Offline banner, retry screens, push token registration (permission asked after the first order).

## Database (migration `0006_customer_features.sql`, tested in `supabase/tests/12_customer_features.sql`)
Item notes, favorites, promo codes (`DEMO` works only while `app_settings.demo_mode = 'true'`), ratings, opening hours (`branch_is_open`, no rows = always open), `create_order` v2 (quantity guard, notes, promo, hours), `cancel_my_order`, `delete_my_account`, `my_addresses` / `add_address`, `list_branches`, `push_tokens`.

## Not done / needs a decision or data
| Item | Why it is open |
|---|---|
| Real card payment | Provider not chosen (D-PAY). Card is a demo simulation. |
| Real SMS | Needs the Georgian SMS provider hook (SMS Office) and an account. |
| Map pin for the address | Needs a maps provider and key. Today the delivery point is the device location. |
| Delivery zones, fees, minimums, branch hours, branch addresses/phones | Owner data. Until zones exist, "nearest branch" and checkout cannot confirm delivery. |
| Prices approval | Prices are from Wolt; the app shows a notice while `products.price_source = 'unapproved'`. |
| Ingredient list for "remove" | Currently derived from the product description. Owner should confirm per product. |
| Legal texts | Written by the lawyer; set `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` or replace the placeholder screen. |
| Push notifications on a phone | Sender is `supabase/functions/notify-order-status` (written, not deployed or tested). Needs `eas init` (project id) and a real device. |
| App icon / splash | Generated from the 513 px logo; a high-resolution or vector logo is needed for the stores. |
| Promo code brute force | `apply_promo` has no rate limit yet. |
| Restaurant panel, admin panel, courier flow | Not part of this app. |

## Run / build
```
pnpm install
pnpm --filter @gochits/customer-app start        # needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm typecheck && pnpm test                       # TypeScript + unit tests
supabase/tests/run-tests.sh                       # database tests (Postgres + PostGIS)
```
Store builds: `eas.json` has development / preview / production profiles. Run `eas init` once to create the project id, then `eas build`.
