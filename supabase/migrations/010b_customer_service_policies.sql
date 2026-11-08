-- 010b: run AFTER 010 (a new enum value cannot be used in the same step that creates it).
create or replace function is_service() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'service' and active)
$$;

drop policy if exists orders_select on orders;
create policy orders_select on orders for select to authenticated
  using (is_admin() or is_service() or (rep_id = auth.uid() and owns_account(account_id)));
drop policy if exists orders_update on orders;
create policy orders_update on orders for update to authenticated
  using (is_admin() or is_service()) with check (is_admin() or is_service());

-- customer service may change only status and notes, never the lines, totals, customer or rep
create or replace function orders_service_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_service() and not is_admin() then
    if new.account_id is distinct from old.account_id or new.rep_id is distinct from old.rep_id or new.lines is distinct from old.lines
       or new.total is distinct from old.total or new.order_no is distinct from old.order_no or new.delivery_date is distinct from old.delivery_date then
      raise exception 'Customer service can only change the status and notes of an order';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_service_guard on orders;
create trigger trg_orders_service_guard before update on orders for each row execute function orders_service_guard();

-- read-only view of all customers and names of reps
drop policy if exists accounts_select on accounts;
create policy accounts_select on accounts for select to authenticated
  using (is_admin() or is_service() or assigned_rep_id = auth.uid());
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin() or is_service());
