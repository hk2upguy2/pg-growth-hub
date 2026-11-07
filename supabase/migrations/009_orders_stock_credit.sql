-- PG Growth Hub: order entry, stock + near-expiry, customer credit limits.
-- Run in the Supabase SQL Editor after 008. Safe to run twice.

-- 1. credit limits -----------------------------------------------------------
alter table accounts add column if not exists credit_limit numeric(14,2) not null default 0;

-- 2. orders ------------------------------------------------------------------
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      text not null,
  account_id    uuid not null references accounts(id) on delete cascade,
  rep_id        uuid references profiles(id) on delete set null,
  status        text not null default 'Submitted' check (status in ('Submitted', 'Confirmed', 'Delivered', 'Cancelled')),
  delivery_date date,
  notes         text not null default '',
  lines         jsonb not null default '[]'::jsonb,
  total         numeric(14,2) not null default 0,
  quote_id      uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_orders_account on orders(account_id);
create index if not exists idx_orders_rep on orders(rep_id);
create index if not exists idx_orders_status on orders(status);
alter table orders enable row level security;
drop policy if exists orders_select on orders;
drop policy if exists orders_insert on orders;
drop policy if exists orders_update on orders;
drop policy if exists orders_delete on orders;
-- reps see and create their own orders on accounts assigned to them; only management changes or deletes them
create policy orders_select on orders for select to authenticated using (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy orders_insert on orders for insert to authenticated with check (
  is_admin() or (is_active_user() and rep_id = auth.uid() and owns_account(account_id) and status = 'Submitted'
                 and not exists (select 1 from accounts a where a.id = account_id and a.status = 'On Hold')));
create policy orders_update on orders for update to authenticated using (is_admin()) with check (is_admin());
create policy orders_delete on orders for delete to authenticated using (is_admin());

-- 3. stock -------------------------------------------------------------------
create table if not exists stock_items (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null,
  product       text not null,
  sku           text not null default '',
  unit          text not null default 'case',
  on_hand       numeric(14,2) not null default 0,
  incoming      numeric(14,2) not null default 0,
  incoming_date date,
  expiry_date   date,
  updated_at    timestamptz not null default now()
);
create unique index if not exists idx_stock_sku on stock_items (lower(brand), lower(coalesce(nullif(sku, ''), product)));
alter table stock_items enable row level security;
drop policy if exists stock_select on stock_items;
drop policy if exists stock_admin_write on stock_items;
create policy stock_select on stock_items for select to authenticated using (is_active_user());
create policy stock_admin_write on stock_items for all to authenticated using (is_admin()) with check (is_admin());

-- 4. audit trail for the new tables (same trigger as the others)
do $$
declare t text;
begin
  foreach t in array array['orders', 'stock_items'] loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function audit_trigger()', t);
  end loop;
end $$;
