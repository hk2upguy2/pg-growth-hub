-- v33: status line written by the Sage link, shown in the CRM so everyone can see the connection is alive.
create table if not exists sage_sync (
  id int primary key default 1,
  last_run timestamptz, ok boolean, message text,
  orders_sent int default 0, orders_skipped int default 0, invoices_matched int default 0, balances_updated int default 0,
  constraint one_row check (id = 1)
);
alter table sage_sync enable row level security;
drop policy if exists sage_sync_read on sage_sync;
create policy sage_sync_read on sage_sync for select to authenticated using (is_admin() or is_service());
-- only the Sage link (service role key) writes to it
