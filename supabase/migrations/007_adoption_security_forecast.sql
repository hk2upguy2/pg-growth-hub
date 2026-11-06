-- PG Growth Hub: rep activity tracking, audit log, account balances.
-- Run in the Supabase SQL Editor BEFORE deploying this version. Safe to run more than once.

-- 1. Last time each user opened the app --------------------------------------
alter table profiles add column if not exists last_seen timestamptz;

-- 2. Balance owed (from Sage, entered or imported) ---------------------------
alter table accounts add column if not exists balance_due     numeric(14,2) not null default 0;
alter table accounts add column if not exists overdue_balance numeric(14,2) not null default 0;
alter table accounts add column if not exists balance_updated date;

-- 3. Audit log: who changed or deleted what ----------------------------------
create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_name text,
  action     text not null,        -- INSERT / UPDATE / DELETE
  entity     text not null,        -- table name
  record_id  text,
  label      text,                 -- human-readable name of the record
  changes    jsonb                 -- for updates: {field: [old, new]}
);
create index if not exists idx_audit_at on audit_log(at desc);
create index if not exists idx_audit_entity on audit_log(entity);
alter table audit_log enable row level security;
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select to authenticated using (is_admin());
-- no insert/update/delete policies: rows are written only by the trigger below (security definer)

create or replace function audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb; old_rec jsonb; diff jsonb := '{}'::jsonb; k text; who text; lbl text;
begin
  select full_name into who from profiles where id = auth.uid();
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  lbl := coalesce(rec->>'name', rec->>'subject', rec->>'full_name', rec->>'product_name', rec->>'summary', rec->>'month', rec->>'id');
  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    for k in select jsonb_object_keys(rec) loop
      if k not in ('updated_at', 'last_seen', 'imported_at') and (rec->k) is distinct from (old_rec->k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(old_rec->k, rec->k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;   -- nothing meaningful changed
  end if;
  insert into audit_log (actor_id, actor_name, action, entity, record_id, label, changes)
  values (auth.uid(), coalesce(who, 'system'), tg_op, tg_table_name, rec->>'id', lbl, case when tg_op = 'UPDATE' then diff end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['accounts','opportunities','profiles','promotions','competitor_tracking','rep_targets','messages','sales_activities'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_audit on %I', t);
      execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function audit_trigger()', t);
    end if;
  end loop;
end $$;
