# Gochit's Delivery — Design Handoff (for Codex / developers)

Status: DESIGN MOCKUPS ONLY. The `screens/*.dc.html` files are visual references, not production code.
Build the real apps per `ARCHITECTURE.md` (Expo + React Native + TypeScript for mobile, Next.js for dashboards, Supabase backend). ARCHITECTURE.md is still a DRAFT awaiting owner approval.

## 6 branches (requirement from owner)
The system must support 6 branches from launch. Each branch has its own delivery zones (PostGIS polygons) with fee, minimum order, free-delivery threshold and extra time. One order belongs to exactly one branch. Flow: Address -> server resolves the branches whose zones contain the address -> BranchPick (if more than one) -> Menu. Screens: `BranchPick` (customer), `AdminBranches` (6 cards, accepting switch, link to zones), `AdminZones` (tabs per branch), branch chip in Menu and a branch row in Checkout. Branch names, addresses, phones, hours and zone shapes are NOT provided: placeholders `[ფილიალი N]`. Open: D-OVERLAP (nearest vs customer choice vs priority), D-BRANCHPRICE, D-COURIERPOOL, D-ZONEDATA. See ARCHITECTURE.md Revision 0.2.

## Brand name
The Facebook page is "Gochit's • გოჩიტ'ს". Earlier project documents used "Gochita". Confirm the official spelling with the owner before naming apps, store listings or the repo.

## Source labels (do not mix these up)
1. FACEBOOK (public page, seen 2026-10-15): name, logo, burger focus, phone 597 06 77 66, email gochitsburgers@gmail.com, cover menu image (older prices).
2. WOLT (Gochit's Burger Dighomi branch, seen 2026-10-15): 50 menu items, 21 product photos, prices and -30% promotions as displayed there. These are NOT approved direct-order prices.
3. OUR DESIGN CHOICES: colors, fonts, animations, wording of buttons and screens. Not official brand rules.

Known conflicts and gaps:
- Prices on the Facebook cover image differ from Wolt prices. The owner must provide the approved direct-order menu and prices.
- Delivery fees, zones, working hours, allergens, full branch list and company details for direct orders are NOT confirmed. Wolt showed "all day" delivery for one branch; do not copy this.
- Rustavi branch (Kapanadze 1, mall, 2nd floor) was mentioned in one Facebook post only; unverified.
- Shared photos: one photo file is used for more than one product in some pairs (Giant Burger / Giant Burger Combo, Fries large / small, Monster / Monster Combo, Jalapeno Triple / combo). Photos shown are the ones Wolt used for those items.
- Items with no photo: Pipipow Double Burger Combo, all wraps/rolls, bowls, fries with melted cheese, sauces, drinks. Show a neutral placeholder; never reuse another product's photo.

## Rules
- Do NOT invent menu items, prices, slogans, policies, names or numbers beyond the sources above. Every `[..]`, `₾ --.--` and `—` in the mockups is a placeholder for real data.
- All UI text is Georgian (`ka`). Keep strings in i18n files.
- Prices, totals, discounts and delivery fees are always computed by the server; the UI only displays them.
- Security-relevant screens (auth, checkout, payments) must follow ARCHITECTURE.md sections 4, 6 and 10.
- No real payments or real order sending until the owner approves the architecture and provider.

## Menu data
`data/wolt-menu-observed.json` and `data/MENU.ka.md`: 50 items in 7 Wolt categories: ბურგერები (12), ბურგერების კომბო (10), ვრეპები და როლები (6), ბოულები (2), გარნირები (3), სოუსები (7), სასმელები (10).
`data/photo-sources.json` maps each photo to its product. Photos are in `photos/` (JPEG, 300×169, low resolution; ask owner for originals).
The mockup menu screen (`screens/Menu.dc.html`) contains the full 50-item list with the same data, prices stored in tetri (1 GEL = 100 tetri).

## Brand tokens
| Token | Value | Source |
|---|---|---|
| yellow (primary) | `#FFCC02` | sampled from the logo image |
| red (action / price) | `#D8141C` | sampled from the logo image |
| ink (dark) | `#1A0D0B` | derived from logo outline |
| cream (background) | `#FFF8E1` | our choice |
| yellow-soft | `#FFF1BF`, `#FFE066` | our choice |
| sand (borders) | `#E8DDB8` | our choice |
| muted text | `#6b5a52` | our choice |
| orange (accent) | `#F28C1E` | our guess, needs owner approval |

The collected package also suggests approximate colors (`#FFD520`, `#ED2436`, dark UI `#111115`, see `data/brand-colors.package.json`). Those were labelled approximations, not official. We use values sampled from the logo. The Facebook cover uses a black and yellow hazard-stripe pattern with red circles and black panels; the menu screen echoes this with a stripe under the header. A dark theme is possible; decide with the owner.
Text on yellow is always ink (dark). Primary action: red background, white text, or ink background with yellow text.

## Typography
Noto Sans Georgian (400, 600, 800). Expo: `@expo-google-fonts/noto-sans-georgian`.

## Shape and spacing
Rounded and friendly: cards radius 18–28, buttons fully rounded, bottom sheets top radius 32–36. Minimum touch target 44px. Screen padding 20px. Phone mockup 390×844.

## Screens and flow
Customer: Main -> Login (phone +995) -> Otp (6 digits) -> Register -> Permissions -> Address -> BranchPick -> Menu -> Product -> Cart -> Checkout -> PaymentResult -> Tracking. Also: AddressList, OrderDetail (with cancel), Profile (with account deletion), States (closed / offline / outside zone).
Courier: CourierPending (application status) -> Courier (online switch, offer) -> CourierDelivery (4 steps) ; CourierHistory.
Web: StaffLogin (email + password + MFA code) -> Restaurant (order columns), RestaurantMenu (availability switches, prices locked to super admin), Admin (overview), AdminBranches, AdminZones (per branch), AdminPromos.
`screens/canvas.json` has the layout and notes of the design canvas.

## Order status labels (match ARCHITECTURE.md section 5)
placed -> accepted -> preparing -> ready_for_pickup -> out_for_delivery -> delivered (+ cancelled / rejected / payment_failed). Confirm final wording with the restaurant.

## Animations (reanimated on mobile, CSS/Framer Motion on web)
Splash logo pop and float; staggered list entry; cart bar slide-up and counter bump; selection pulses; route line, courier marker and status steps on tracking; radar and offer countdown for couriers; confetti on delivered; pulsing new-order card; page-success check draw; shake on payment failure. Respect "reduce motion": disable all.

## Form behavior shown
Login enables at 9 digits; OTP resend after 30 s; Register needs name (2+ chars) and terms; promo codes validated on server only; cash on delivery only if the branch enables it (D-COD pending); courier and admin accounts require approval/MFA per architecture.

## Open decisions that affect UI
Official name spelling; approved menu and prices; delivery zones/fees/hours; guest checkout; cash on delivery; payment provider; languages; legal texts (lawyer); courier model and pay; account deletion rules.

## Not designed yet
Notifications list, refunds UI, audit log, staff management, hours editor, courier earnings, dark theme.

## Note about the mockup files
The .dc.html files load images from internal addresses (/_blob/...) that work only inside the design page. Outside it images will not show; use `logo.png` and the files in `photos/`. They also expect a support.js runtime that is not included, so treat them as reading material (markup, colors, spacing, animation values), not as files to run.
