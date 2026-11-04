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

The demo records (Hyatt Regency Guam, Dusit Thani, Hilton, Pay-Less, Don Don Donki, HappyMart, Cost-U-Less, Jamaican Grill, King's, Shirley's, Mosa's Joint, Pasak Chicken) are **illustrative only**. They are flagged "Demo", are not confirmed Pacific Grocers customers, contain no verified contact details, and every dollar value is an illustrative estimate. Actual monthly sales are `$0` on all of them. Management can remove them under Settings → *Remove demo records*.

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
