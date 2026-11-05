-- PG Growth Hub: sales channels.
-- Retail reps only see Retail accounts. Hospitality reps only see Hotel, Foodservice and Institutional accounts.
-- Run in the Supabase SQL Editor BEFORE deploying the version with "Sales channel".

alter table profiles add column if not exists channel text not null default 'All';
alter table profiles drop constraint if exists profiles_channel_check;
alter table profiles add constraint profiles_channel_check check (channel in ('All', 'Retail', 'Hospitality'));

-- Does this user's channel cover this account type? (admins and 'All' reps: yes)
create or replace function channel_allows(uid uuid, t account_type) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.role = 'admin' or p.channel = 'All' then true
      when p.channel = 'Retail' then t = 'Retail'
      when p.channel = 'Hospitality' then t <> 'Retail'
      else true end
    from profiles p where p.id = uid
  ), false)
$$;

-- A rep can only own / see accounts inside their channel; this also covers activities, opportunities, sales, etc.
create or replace function owns_account(acct uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts
    where id = acct and assigned_rep_id = auth.uid() and channel_allows(auth.uid(), type)
  )
$$;

drop policy if exists accounts_select on accounts;
drop policy if exists accounts_insert on accounts;
drop policy if exists accounts_update on accounts;
create policy accounts_select on accounts for select to authenticated
  using (is_admin() or (assigned_rep_id = auth.uid() and channel_allows(auth.uid(), type)));
create policy accounts_insert on accounts for insert to authenticated
  with check (is_admin() or (is_active_user() and assigned_rep_id = auth.uid() and channel_allows(auth.uid(), type)));
create policy accounts_update on accounts for update to authenticated
  using (is_admin() or (assigned_rep_id = auth.uid() and channel_allows(auth.uid(), type)))
  with check (is_admin() or (assigned_rep_id = auth.uid() and channel_allows(auth.uid(), type)));

-- Nobody (including management) can assign an account to a rep whose channel does not cover it.
create or replace function guard_account_channel() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_rep_id is not null and not channel_allows(new.assigned_rep_id, new.type) then
    raise exception 'This account type does not match the rep''s sales channel';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_account_channel on accounts;
create trigger trg_guard_account_channel before insert or update of assigned_rep_id, type on accounts
  for each row execute function guard_account_channel();

-- Only administrators may change a rep's channel (same rule as role / status / territory).
create or replace function guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and (new.role is distinct from old.role or new.active is distinct from old.active
     or new.territory is distinct from old.territory or new.channel is distinct from old.channel) then
    raise exception 'Only administrators can change role, status, territory or sales channel';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active administrator is required';
  end if;
  return new;
end $$;
