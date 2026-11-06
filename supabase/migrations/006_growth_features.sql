-- PG Growth Hub: more brands, message replies, rep targets.
-- Run in the Supabase SQL Editor BEFORE deploying this version. Safe to run more than once.

-- 1. More brands -------------------------------------------------------------
insert into brands (name, supplier) values
  ('OxKing', 'OxKing'), ('Pampeano', 'Pampeano'), ('Orion', 'Orion')
on conflict (name) do nothing;

insert into products (brand_id, name)
select b.id, p.name from brands b join (values
  ('OxKing','Corned Beef'), ('OxKing','Other OxKing'),
  ('Pampeano','Corned Beef'), ('Pampeano','Other Pampeano'),
  ('Orion','Choco Pie'), ('Orion','Other Orion')
) as p(brand, name) on p.brand = b.name
where not exists (select 1 from products x where x.brand_id = b.id and x.name = p.name);

-- 2. Message replies ---------------------------------------------------------
alter table messages add column if not exists parent_id uuid references messages(id) on delete cascade;
create index if not exists idx_messages_parent on messages(parent_id);

drop policy if exists messages_select on messages;
drop policy if exists messages_rep_reply on messages;
drop policy if exists reads_insert on message_reads;

-- Management sees all. A rep sees messages to them or everyone, and the replies they wrote.
create policy messages_select on messages for select to authenticated
  using (is_admin() or (is_active_user() and (recipient_id is null or recipient_id = auth.uid() or sender_id = auth.uid())));

-- A rep may only write a reply (parent_id set), as themselves, addressed to a person (not everyone).
create policy messages_rep_reply on messages for insert to authenticated
  with check (
    is_active_user() and sender_id = auth.uid() and parent_id is not null and recipient_id is not null
    and exists (
      select 1 from messages m where m.id = parent_id
        and (m.recipient_id is null or m.recipient_id = auth.uid() or m.sender_id = auth.uid())
    )
  );

-- Read receipts: you can mark read any message you are allowed to see that was not written by you.
create policy reads_insert on message_reads for insert to authenticated
  with check (
    user_id = auth.uid() and exists (
      select 1 from messages m where m.id = message_id and (m.recipient_id is null or m.recipient_id = auth.uid())
    )
  );

-- 3. Rep targets -------------------------------------------------------------
create table if not exists rep_targets (
  id                   uuid primary key default gen_random_uuid(),
  rep_id               uuid not null references profiles(id) on delete cascade,
  month                date not null,
  sales_target         numeric(14,2) not null default 0,
  visits_target        integer not null default 0,
  new_accounts_target  integer not null default 0,
  updated_at           timestamptz not null default now(),
  unique (rep_id, month)
);
alter table rep_targets enable row level security;
drop policy if exists targets_select on rep_targets;
drop policy if exists targets_admin_write on rep_targets;
create policy targets_select on rep_targets for select to authenticated using (is_admin() or rep_id = auth.uid());
create policy targets_admin_write on rep_targets for all to authenticated using (is_admin()) with check (is_admin());

-- 4. Reps can see the names of management (needed to show who a message is from)
drop policy if exists profiles_select_admins on profiles;
create policy profiles_select_admins on profiles for select to authenticated
  using (role = 'admin' and is_active_user());
