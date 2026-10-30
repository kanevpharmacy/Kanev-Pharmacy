# Kanev Pharmacy — cross-platform starter

**Brand:** Kanev Pharmacy  
**Tagline:** Closer to Your Health  
**Initial target:** Zambia (ZMW), web, Android and iOS  
**Stack:** Expo + React Native + React Native Web; optional Supabase backend.

## What is included

- Responsive customer storefront with Home, Shop, category filters, search, product detail, cart, checkout form and account placeholder.
- Shared React Native codebase for web, Android and iOS.
- ZMW price formatting and pharmacy brand palette.
- Demo product catalogue clearly separated in `src/data/products.js`.
- Initial Supabase/Postgres schema in `supabase/schema.sql`.
- Prescription-required items are blocked from normal cart addition in the demo UI.
- No secret keys or fake payment integrations included.

## Run locally

Install Node.js LTS (recommended) and a current npm version. From this folder:

```bash
npm install
npm run start
```

Use the Expo terminal shortcuts to open Android/iOS, or press `w` to run web. For web directly:

```bash
npm run web
```

For Android/iOS simulator builds, install the relevant Android Studio / Xcode tooling. Expo Go is useful for early device testing, but store builds need a proper production build and signing configuration.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor after reviewing it for your environment.
3. Copy `.env.example` to `.env`.
4. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Add Supabase client setup and server/Edge Functions before enabling real accounts, orders or inventory writes.

The current UI intentionally uses demo data and does **not** persist real orders. The checkout displays a notice rather than claiming that an order was submitted. Do not accept real payments until server-side order validation, stock reservation, payment confirmation and reconciliation have been implemented and tested.

## Before launch checklist

- Replace every demo product, illustrative price and icon with verified Kanev catalogue data, pack sizes, images, stock and approved product information.
- Connect authentication, email/phone verification, password recovery and customer profile.
- Implement a trusted order-creation Edge Function that recalculates prices, checks stock, records immutable item snapshots and creates an order number.
- Add admin/staff roles securely; never trust a role supplied by a client.
- Implement pharmacist review, prescription upload and restricted-medicine fulfilment according to applicable Zambian requirements.
- Configure delivery zones, collection branches, delivery fees, customer notifications, cancellations and refunds.
- Integrate a payment provider only after its live API, webhook signatures, idempotency, settlement and refund flows are verified.
- Add privacy policy, terms, returns/refunds policy, contact details, data-retention policy and consent notices.
- Add accessibility checks, error monitoring, automated tests, backups and audit logs.
- Prepare real app icons, splash screens, screenshots, privacy declarations and store metadata.
- Test on physical Android and iPhone devices and browsers before release.

## Important pharmacy and safety note

This is a functional UI starter, not a production-ready regulated pharmacy service. Public product pages must not imply that a prescription medicine can be bought without the required review. Product descriptions and health claims must use approved information. Confirm applicable requirements with the relevant Zambian pharmacy regulator and qualified pharmacy professionals before publishing.

## Main files

- `App.js` — customer app and navigation
- `src/theme.js` — Kanev design palette
- `src/data/products.js` — demo catalogue
- `supabase/schema.sql` — initial database schema
- `app.json` — Expo web/mobile configuration
- `.env.example` — backend configuration placeholders
