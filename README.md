# PG Growth Hub

Guam sales CRM and business-development platform for Pacific Grocers.
React + TypeScript · Tailwind · Lucide · Recharts · Supabase (Auth + Postgres + RLS) · Vercel-ready · PWA.

## Status

| Stage | Scope | State |
|---|---|---|
| 1 | Responsive frontend + navigation (14 sections) | Done |
| 2 | Account CRUD, directory, detail pages | Done |
| 3 | Sales activities + opportunities (weighted pipeline) | Done |
| 4 | Dashboard calculations + 11 reports | Done |
| 5 | Supabase auth + database integration | **Code written, not yet verified against a live project.** Email/password login, load + save for every table (`src/lib/db.ts`). Needs the SQL run once in your project (below) |
| 6 | Role-based permissions | Enforced in the demo data layer (`src/lib/store.tsx`) and in Postgres RLS (`supabase/migrations/002_rls.sql`). The RLS policies have **not yet been run against a live Supabase project** |
| 7 | CSV / Excel export + PWA | Done (exports are CSV and Excel-compatible `.xls`; PWA manifest + service worker via `vite-plugin-pwa`) |
| 8 | Testing | Type-check and production build pass. Manual UI testing and Supabase testing still to do |

## Demo mode (default)

With no Supabase credentials the app runs fully in the browser using `localStorage`. Pick a demo user on the sign-in screen:

- **Demo Manager** (Management): sees everything, manages users, exports, deletes.
- **Demo Rep A/B/C** (Sales Rep): see only their assigned accounts and related records.

Demo mode loads 100 illustrative accounts: 12 named after well-known Guam businesses (Hyatt Regency Guam, Dusit Thani, Hilton, Pay-Less, Don Don Donki, HappyMart, Cost-U-Less, Jamaican Grill, King's, Shirley's, Mosa's Joint, Pasak Chicken) plus 88 generated ones whose names all end in “(Demo)”. All are **illustrative only**. They are flagged "Demo", are not confirmed Pacific Grocers customers, contain no verified contact details, and every dollar value is an illustrative estimate. Actual monthly sales are `$0` on all of them. Management can remove them under Settings → *Remove demo records*.

## Install and run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build && npm run preview
```

Requires Node 18+.

## Connect Supabase (Stage 5 — credentials required)

1. Create a project at supabase.com.
2. In **SQL Editor**, run `supabase/migrations/001_schema.sql`, then `002_rls.sql`.
3. **Authentication → Providers**: enable Email. For an internal tool, disable public sign-ups and invite users instead.
4. Copy `.env.example` to `.env.local` and set:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
   Use only the **anon** key in the frontend. Never expose the `service_role` key.
5. The **first** user to sign up becomes the administrator; everyone after is a sales rep. Admins promote users in User Management (database trigger blocks anyone else from changing roles).

When the two env vars are set the app switches from demo mode to Supabase automatically: the sign-in screen becomes email + password, data loads through `src/lib/db.ts`, and saves go to the database (the screen updates immediately, then the server confirms; a failed save shows an error and reloads from the server). The app also reloads data when it returns to the foreground so reps see each other's updates.

**First-run checklist**
1. Run `001_schema.sql` then `002_rls.sql` in the Supabase SQL Editor.
2. Authentication → Sign In / Providers → Email: for a quick start turn off "Confirm email" (turn it back on later if you prefer).
3. **You create your account first on the sign-in screen**: the first account becomes the administrator.
4. Each rep then creates their own account (or you invite them from Authentication → Users). Open User Management to set their territory, then assign accounts to them.
5. In Authentication → Sign In / Providers, switch off public sign-ups once your 12 reps are in.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework preset: Vite; build `npm run build`; output `dist`).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project → Settings → Environment Variables (once Supabase is wired).
3. `vercel.json` already rewrites all routes to `index.html` for client-side routing.

## Structure

```
src/
  types.ts              domain types, Guam villages/territories, brands, stages
  lib/store.tsx         data layer with role-scoped reads and permission-checked writes (demo mode)
  lib/seed.ts           illustrative demo data
  lib/analytics.ts      dashboard KPIs, weighted pipeline, visit-first ranking
  lib/utils.ts          formatting, CSV / Excel export
  lib/supabase.ts       Supabase client (activates when env vars are set)
  components/           Layout, shared UI, account / activity / opportunity forms
  pages/                Dashboard, Accounts, AccountDetail, Activities, Opportunities, Products,
                        RoutePlanner, Promotions, Competitors, Reports, Users, Settings, Login
supabase/migrations/    001_schema.sql, 002_rls.sql
```

## Notes

- Route Planner builds daily visit lists by territory and ranks accounts to visit first. It does **not** do GPS or map routing; that would need a mapping service such as Google Maps or Mapbox.
- Weighted pipeline = estimated monthly value × probability for open opportunities. In Postgres it is a generated column, so the client cannot spoof it.
- Competitor attachments are stored as data URLs in demo mode (1.5 MB limit) and map to a private Supabase Storage bucket in production.

## Importing data

- **Accounts:** Account Directory, then Import (management only). Upload a CSV (Excel: Save As, CSV UTF-8). Columns are matched automatically, duplicates are skipped, and unrecognised values use the defaults you choose. Include a *Customer Number* column to store the Sage customer number.
- **Assign to reps:** tick accounts in the Account Directory, choose a rep, click Assign.
- **Sage sales:** Account Directory, then Sales update. Upload a CSV with customer number, month or invoice date, amount, and optionally brand and quantity. Loading the same month again replaces it. Each account's *actual monthly sales* becomes the average of the newest three months in the data; *last order* is the newest sale; a Prospect that has bought becomes Active.
- **Supabase:** run `supabase/migrations/003_sage_sales.sql` **before** deploying this version.

## Messages

Management: Messages, then choose **All sales reps** or **Choose reps** (one or several), write the message, optionally mark it urgent. The Sent list shows how many reps have read each one. Reps see only messages addressed to them or to everyone, with an unread badge in the menu.
- **Supabase:** run `supabase/migrations/004_messages.sql` **before** deploying this version.

## Sales channels

Under User Management, each rep gets a **Sales channel**: *Retail only*, *Hotel & Foodservice only* (also covers Institutional), or *All accounts*. A Retail rep never sees Hotel or Foodservice accounts, and a Hospitality rep never sees Retail accounts (including their activities, opportunities and sales). Management cannot assign an account to a rep outside that channel; the Assign button skips and reports mismatches. Enforced in Postgres by `supabase/migrations/005_sales_channel.sql` — run it **before** deploying this version.

## Lapsed customers, scorecards, brands, replies (v10)

- **Lapsed customers:** Dashboard panel and Accounts filter *No order 30d+* list buying customers whose last Sage order is 30+ days old (amber 30, orange 45, red 60). Also a report.
- **Scorecard:** managers set monthly sales, visit and new-account targets per rep; reps see their own. Sales come from the Sage import, visits from logged Customer Visit activities.
- **Brands:** OxKing, Pampeano and Orion added alongside Agrosuper, Hostess and Kikkoman (opportunities, promotions, Sage brand detection, reports).
- **Message replies:** reps reply to a manager's message; managers see replies in the conversation and answer each rep. Urgent unread messages show on the rep dashboard.
- **Supabase:** run `supabase/migrations/006_growth_features.sql` **before** deploying this version.

## Adoption, security and forecasting (v11)

- **Quick visit log:** a round button on every screen (phone-friendly). Pick the account, tap the outcome and a follow-up, save. Works offline: visits are held on the device and sent when the connection returns.
- **Team Activity (management):** last activity, last time each rep opened the app, visits this week/month, overdue follow-ups, and reps who have gone quiet.
- **Audit Log (management):** who created, changed or deleted accounts, opportunities, users, promotions, targets, messages and activities. Written by database triggers in Supabase.
- **Two-step login:** Settings, Two-step login (authenticator app). Optional per user; recommended for managers.
- **Forecast:** weighted pipeline by expected closing month, win rate by brand, loss reasons and opportunities that need attention. Opportunities now require a next action and expected closing date; lost ones require a reason. Stage definitions are shown on the form and on the Forecast page.
- **Account view:** next best action, what they buy (3 months vs prior 3), last order, balance owed and active promotions at the top of every account.
- **Balances:** *Balance owed* and *Overdue balance* can be edited on an account or imported with the customer list.
- **Supabase:** run `supabase/migrations/007_adoption_security_forecast.sql` **before** deploying this version.

## Photos, offline reading, alerts (v12)

- **Shelf photos:** on the Log visit screen (or any account) tap *Take or choose photo*, pick a type (Shelf survey, Display check, Competitor, Delivery / stock) and optionally a brand and caption. Pictures are shrunk on the phone. *Shelf Photos* in the menu shows every photo with filters (for the Orion shelf survey and Hostess display checks). Stored in a private Supabase bucket.
- **Offline:** the app keeps the last loaded data on the phone, so accounts can be read without signal, and visits (with photos) are queued and sent on reconnect. Other edits need a connection. Signing out clears the saved copy.
- **Alerts:** the bell in the menu lists unread messages, follow-ups due, customers who stopped ordering, overdue balances, accepted quotes and (managers) big wins. A morning email digest is available: see `docs/NOTIFICATIONS.md`.
- **Quotes, price list, balances, commissary and other-island accounts:** see the Quotes, Price List and Account Directory sections.
- **Supabase:** run `supabase/migrations/008_photos_quotes_markets.sql` **before** deploying this version.

## v13: Sales Insights, Orders, Stock & Expiry, Village Board, credit limits, incentives
Run `supabase/migrations/009_orders_stock_credit.sql` in the Supabase SQL Editor BEFORE deploying (orders, stock_items, accounts.credit_limit).
- **Sales Insights** (no new data needed): Whitespace (brands similar customers buy that this one does not), Reorders (regular buyers who are due), Supplier report (print or CSV per brand), Promo results (before vs during, net of other accounts).
- **Orders**: reps submit orders from the price list or from an accepted quote (Quotes > Make order); logged as an activity; stock levels shown on each line; only management changes status. Reps cannot order for On Hold accounts.
- **Credit limit**: set on the account (management) or synced from Sage; warns before a quote or order that is near, at or over the limit.
- **Stock & Expiry**: management imports or types stock; everyone sees low stock and the near-expiry "push this week" list; the bell flags it.
- **Village Board**: every village at a glance (sales, buying, stopped ordering, not visited in 30+ days).
- **Scorecard**: incentive points and Gold / Silver / Bronze tiers (sales 60%, visits 20%, new accounts 20%). Tiers are a starting point, not your real plan.
- Sage sync: now also carries CreditLimit.
