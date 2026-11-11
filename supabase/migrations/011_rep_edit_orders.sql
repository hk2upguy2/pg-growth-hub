-- Reps can change their own order until customer service confirms it.
-- Run after 010b. Safe to run twice.

alter table orders add column if not exists edited_at timestamptz;

drop policy if exists orders_update on orders;
create policy orders_update on orders for update to authenticated
  using (
    is_admin() or is_service()
    or (rep_id = auth.uid() and status = 'Submitted' and owns_account(account_id))
  )
  with check (
    is_admin() or is_service()
    or (rep_id = auth.uid() and status = 'Submitted' and owns_account(account_id))
  );

-- a rep may change the lines, delivery date and notes only: never the order number, customer, owner or status, and the edit is stamped
create or replace function orders_rep_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and not is_service() then
    if new.account_id is distinct from old.account_id or new.order_no is distinct from old.order_no or new.rep_id is distinct from old.rep_id then
      raise exception 'Reps cannot change the customer or the order number';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only customer service or management can change the status';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_rep_guard on orders;
create trigger trg_orders_rep_guard before update on orders for each row execute function orders_rep_guard();
