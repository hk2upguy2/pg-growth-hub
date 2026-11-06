-- Safe to run on an existing database. Fixes promotions RLS infinite recursion.
-- Helpers for promotions. They bypass RLS (security definer) so the promotions and
-- promotion_accounts policies do not query each other, which causes infinite recursion.
create or replace function promo_visible_to_rep(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from promotion_accounts pa
                 join accounts a on a.id = pa.account_id
                 where pa.promotion_id = pid and a.assigned_rep_id = auth.uid())
$$;

create or replace function promo_is_mine(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from promotions where id = pid and responsible_id = auth.uid())
$$;

-- ---------- promotions ----------
drop policy if exists promos_select on promotions;
create policy promos_select on promotions for select to authenticated
  using (is_admin() or responsible_id = auth.uid()
         or promo_visible_to_rep(id));
drop policy if exists promos_insert on promotions;
create policy promos_insert on promotions for insert to authenticated
  with check (is_admin() or (is_active_user() and responsible_id = auth.uid()));
drop policy if exists promos_update on promotions;
create policy promos_update on promotions for update to authenticated
  using (is_admin() or responsible_id = auth.uid())
  with check (is_admin() or responsible_id = auth.uid());
drop policy if exists promos_delete on promotions;
create policy promos_delete on promotions for delete to authenticated
  using (is_admin() or responsible_id = auth.uid());

drop policy if exists promo_accounts_select on promotion_accounts;
create policy promo_accounts_select on promotion_accounts for select to authenticated
  using (is_admin() or owns_account(account_id)
         or promo_is_mine(promotion_id));
drop policy if exists promo_accounts_write on promotion_accounts;
create policy promo_accounts_write on promotion_accounts for all to authenticated
  using (is_admin() or (owns_account(account_id)
         and promo_is_mine(promotion_id)))
  with check (is_admin() or (owns_account(account_id)
         and promo_is_mine(promotion_id)));

