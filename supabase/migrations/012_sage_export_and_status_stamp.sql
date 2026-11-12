-- Run after 011. Safe to run twice.
-- 1) remember which orders were exported to Sage, so nobody keys the same order twice
-- 2) remember when an order's status last changed, so reps are told "your order was confirmed"

alter table orders add column if not exists sage_exported_at timestamptz;
alter table orders add column if not exists status_changed_at timestamptz;
alter table orders alter column status_changed_at set default now();   -- new orders only; existing ones stay empty so reps are not flooded with old news

create or replace function orders_status_stamp() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.status_changed_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_orders_status_stamp on orders;
create trigger trg_orders_status_stamp before update on orders for each row execute function orders_status_stamp();

-- reps can never touch the export or status stamps (replaces the guard from 011)
create or replace function orders_rep_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and not is_service() then
    if new.account_id is distinct from old.account_id or new.order_no is distinct from old.order_no or new.rep_id is distinct from old.rep_id then
      raise exception 'Reps cannot change the customer or the order number';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only customer service or management can change the status';
    end if;
    if new.sage_exported_at is distinct from old.sage_exported_at then
      raise exception 'Reps cannot change the Sage export marker';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
