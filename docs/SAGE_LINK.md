# Sage link: CRM and Sage 100 talking to each other

A small program (the "Sage link") runs on the Sage server at the office. Every 5 minutes it:

1. **CRM to Sage:** takes orders the office has **Confirmed**, writes them as a Visual Integrator file into a folder, and marks them "In Sage".
2. **Sage to CRM:** reads Sage's invoices and open orders and puts the **Sage invoice number, invoice date and total** on the matching CRM order (matched on the CRM order number in Sage's Customer PO field).
3. **Sage to CRM:** updates each customer's **balance** (and overdue, if your query returns it).

The CRM shows "Sage link: synced 2 min ago" on the Orders page. If the link stops, it turns amber, then red.
Why a program on the server: Sage 100 lives inside your office network, and the internet-hosted CRM cannot reach into it. The link reaches out instead.

## What you need first
- A Windows PC or server at the office that is **on all day** and can open Sage 100 data (the Sage server itself is best).
- **Node.js 20+** installed on it (nodejs.org, LTS).
- A **read-only Sage user** for the link (Sage 100: Library Master, Role Maintenance / User Maintenance), and the **ODBC DSN** for Sage 100 (usually `SOTAMAS90`; created by the Sage 100 ODBC driver install).
- Your **Supabase service_role key** (Supabase, Project Settings, API). It is a master key: keep it only in the link's `.env` file, never in the CRM or in an email.
- Run migration `015_sage_sync.sql` (and 014) in Supabase.

## Setup (about an hour, with whoever manages Sage)
1. Copy the project folder to the server (or `git clone`). In it run `npm install`, then `npm install odbc`.
2. Copy `bridge/.env.example` to `.env` (project root) and fill it in.
3. Check the Sage table and column names: `npm run bridge -- --discover`. It prints the columns of `AR_Customer`, `AR_InvoiceHistoryHeader` and `SO_SalesOrderHeader`. If a name differs from `bridge/queries.json`, edit that file.
4. **Visual Integrator job for orders.** In Sage 100: Visual Integrator, Import Job Maintenance. Create a job for Sales Order Header and Detail from a delimited file (comma, first row = column names). Map the columns to the names in the file: SalesOrderNo, OrderDate, ShipExpireDate, CustomerNo, CustomerPONo, SalesPerson, WarehouseCode, Comment, LineNo, ItemCode, ItemCodeDesc, UnitOfMeasure, QuantityOrdered, ListPrice, DiscountPercent, UnitPrice. Point the file at the `SAGE_ORDERS_OUT` folder. Test it once by hand with a sample file.
   Then schedule the job (Windows Task Scheduler running Sage's Visual Integrator job command, ask your Sage reseller for the exact command for your version).
5. Dry run (changes nothing): `npm run bridge -- --once --dry-run`. Read what it says it would send and match.
6. Real run once: `npm run bridge -- --once`. Check the order appears in Sage after the Visual Integrator job runs.
7. Keep it running: Windows Task Scheduler, "At startup", action `npm run bridge` in the project folder (or use NSSM to make it a Windows service). It restarts itself if a cycle fails.

## Without ODBC (start here if ODBC is hard)
Leave `SAGE_DSN` empty and set `SAGE_LISTINGS_IN` to a folder. Save Sage's **Invoice Listing** and **Open Sales Order Listing** there as .xlsx (or schedule them from Sage). The link reads the newest of each. Orders still go out automatically; invoice numbers come back from those files. Balances need ODBC.

## Salesperson codes
Sage wants its salesperson code (for example 0010), not a name. Put the mapping in `.env`: `SALES_CODES={"Maria Cruz":"0010"}`. Reps with no entry are sent by name, which Sage may reject.

## Not verified yet (no access to your Sage from here)
- The Visual Integrator job and the exact Sage column names for your version. `--discover` and the dry run exist so this is checked before real orders flow.
- The Sage 100 field names in `queries.json` (taken from the standard Sage 100 tables, and from the columns in your two listings).
- Prices and stock from Sage are not in this version: the link handles orders, invoices and balances. Prices and stock are next.

## Safety
- Orders are marked "In Sage" only after the file is written. If anything fails, the order is retried next cycle, and the failure shows in the CRM.
- An order is never sent twice, and never sent without a Sage customer number or item codes (it is listed with the reason).
- The link only **reads** Sage. The only way it changes Sage is the file that Visual Integrator imports, which you control.
