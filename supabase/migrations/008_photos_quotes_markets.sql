-- PG Growth Hub: visit photos, price list + quotes, commissary / other-island accounts.
-- Run in the Supabase SQL Editor BEFORE deploying this version (after 001-007). Safe to run more than once.

-- 1. Commissary and other-island accounts ------------------------------------
alter table accounts add column if not exists market text not null default 'Guam';
alter table accounts drop constraint if exists accounts_market_check;
alter table accounts add constraint accounts_market_check check (market in ('Guam', 'Military', 'Other Island'));
alter table accounts add column if not exists island text;
create index if not exists idx_accounts_market on accounts(market);

-- 2. Price list and quotes ---------------------------------------------------
create table if not exists price_items (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  product     text not null,
  sku         text not null default '',
  unit        text not null default 'case',
  price       numeric(12,2) not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table price_items enable row level security;
drop policy if exists price_select on price_items;
drop policy if exists price_admin_write on price_items;
create policy price_select on price_items for select to authenticated using (is_active_user());
create policy price_admin_write on price_items for all to authenticated using (is_admin()) with check (is_admin());

create table if not exists quotes (
  id             uuid primary key default gen_random_uuid(),
  quote_no       text not null,
  account_id     uuid not null references accounts(id) on delete cascade,
  rep_id         uuid references profiles(id) on delete set null,
  status         text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Declined')),
  valid_until    date,
  notes          text not null default '',
  lines          jsonb not null default '[]'::jsonb,
  total          numeric(14,2) not null default 0,
  activity_id    uuid,
  opportunity_id uuid,
  created_at     timestamptz not null default now()
);
create index if not exists idx_quotes_account on quotes(account_id);
create index if not exists idx_quotes_rep on quotes(rep_id);
alter table quotes enable row level security;
drop policy if exists quotes_select on quotes;
drop policy if exists quotes_insert on quotes;
drop policy if exists quotes_update on quotes;
drop policy if exists quotes_delete on quotes;
create policy quotes_select on quotes for select to authenticated using (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy quotes_insert on quotes for insert to authenticated with check (is_admin() or (is_active_user() and rep_id = auth.uid() and owns_account(account_id)));
create policy quotes_update on quotes for update to authenticated using (is_admin() or (rep_id = auth.uid() and owns_account(account_id)))
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy quotes_delete on quotes for delete to authenticated using (is_admin() or (rep_id = auth.uid() and status = 'Draft'));

-- 3. Visit photos ------------------------------------------------------------
create table if not exists visit_photos (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  activity_id uuid,
  rep_id      uuid references profiles(id) on delete set null,
  path        text not null,
  tag         text not null default 'Shelf survey',
  brand       text,
  caption     text not null default '',
  taken_at    timestamptz not null default now()
);
create index if not exists idx_photos_account on visit_photos(account_id);
create index if not exists idx_photos_taken on visit_photos(taken_at desc);
alter table visit_photos enable row level security;
drop policy if exists photos_select on visit_photos;
drop policy if exists photos_insert on visit_photos;
drop policy if exists photos_delete on visit_photos;
create policy photos_select on visit_photos for select to authenticated using (is_admin() or owns_account(account_id));
create policy photos_insert on visit_photos for insert to authenticated with check (is_admin() or (is_active_user() and rep_id = auth.uid() and owns_account(account_id)));
create policy photos_delete on visit_photos for delete to authenticated using (is_admin() or rep_id = auth.uid());

-- private storage bucket; files live in a folder named after the uploader's user id
insert into storage.buckets (id, name, public) values ('visit-photos', 'visit-photos', false) on conflict (id) do nothing;
drop policy if exists "photos upload own folder" on storage.objects;
drop policy if exists "photos read allowed" on storage.objects;
drop policy if exists "photos delete own or admin" on storage.objects;
create policy "photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos read allowed" on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and (is_admin() or exists (select 1 from visit_photos p where p.path = name and owns_account(p.account_id))));
create policy "photos delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'visit-photos' and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text));

-- 4. Audit the new tables ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['quotes', 'price_items', 'visit_photos'] loop
    execute format('drop trigger if exists trg_audit on %I', t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function audit_trigger()', t);
  end loop;
end $$;
