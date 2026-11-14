-- v32: Sage invoice numbers on orders (loaded from Sage's Invoice Listing / Open Sales Order Listing).
alter table orders add column if not exists invoice_no text;
alter table orders add column if not exists invoiced_at date;
alter table orders add column if not exists invoice_total numeric(12,2);
alter table orders add column if not exists sage_order_no text;

-- reps can never change these (replaces the guard from 012); the office can
create or replace function orders_rep_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and not is_service() then
    if new.account_id is distinct from old.account_id or new.order_no is distinct from old.order_no or new.rep_id is distinct from old.rep_id then
      raise exception 'Reps cannot change the customer or the order number';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only customer service or management can change the status';
    end if;
    if new.sage_exported_at is distinct from old.sage_exported_at
       or new.invoice_no is distinct from old.invoice_no or new.invoiced_at is distinct from old.invoiced_at
       or new.invoice_total is distinct from old.invoice_total or new.sage_order_no is distinct from old.sage_order_no then
      raise exception 'Reps cannot change the Sage markers';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
