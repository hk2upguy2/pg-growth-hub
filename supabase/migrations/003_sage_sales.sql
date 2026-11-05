-- PG Growth Hub: Sage customer numbers and monthly sales
-- Run this BEFORE deploying the app version that includes "Sales update".

alter table accounts add column if not exists sage_customer_no text;
alter table accounts add column if not exists last_order_date date;

create unique index if not exists idx_accounts_sage_no
  on accounts (upper(trim(sage_customer_no)))
  where sage_customer_no is not null and trim(sage_customer_no) <> '';

create table if not exists sales_monthly (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  month        date not null,
  brand        text not null,
  amount       numeric(14,2) not null default 0,
  quantity     numeric(14,2),
  last_date    date,
  imported_at  timestamptz not null default now(),
  unique (account_id, month, brand)
);
create index if not exists idx_sales_account on sales_monthly(account_id);
create index if not exists idx_sales_month   on sales_monthly(month);

alter table sales_monthly enable row level security;

drop policy if exists sales_select on sales_monthly;
drop policy if exists sales_admin_write on sales_monthly;

create policy sales_select on sales_monthly for select to authenticated
  using (is_admin() or owns_account(account_id));
create policy sales_admin_write on sales_monthly for all to authenticated
  using (is_admin()) with check (is_admin());
