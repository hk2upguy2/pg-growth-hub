-- PG Growth Hub — row-level security
-- Rules are enforced by Postgres, so they hold no matter what the frontend does.
--   * Sales reps: only accounts assigned to them, and records tied to those accounts or created by them.
--   * Admins (management): everything.

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create or replace function owns_account(acct uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = acct and assigned_rep_id = auth.uid())
$$;

alter table profiles            enable row level security;
alter table brands              enable row level security;
alter table products            enable row level security;
alter table accounts            enable row level security;
alter table account_contacts    enable row level security;
alter table sales_activities    enable row level security;
alter table opportunities       enable row level security;
alter table promotions          enable row level security;
alter table promotion_accounts  enable row level security;
alter table competitor_tracking enable row level security;
alter table route_plans         enable row level security;
alter table route_visits        enable row level security;
alter table notifications       enable row level security;

-- ---------- profiles ----------
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy profiles_insert_admin on profiles for insert to authenticated
  with check (is_admin());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
create policy profiles_delete_admin on profiles for delete to authenticated
  using (is_admin());

-- Block privilege escalation: only admins may change role / active / territory.
create or replace function guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and (new.role is distinct from old.role or new.active is distinct from old.active or new.territory is distinct from old.territory) then
    raise exception 'Only administrators can change role, status or territory';
  end if;
  -- never leave the system without an active admin
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active administrator is required';
  end if;
  return new;
end $$;
create trigger trg_guard_profile before update on profiles for each row execute function guard_profile_update();

-- ---------- reference data: read-only for everyone signed in, admin-managed ----------
create policy brands_select on brands for select to authenticated using (is_active_user());
create policy brands_admin  on brands for all    to authenticated using (is_admin()) with check (is_admin());
create policy products_select on products for select to authenticated using (is_active_user());
create policy products_admin  on products for all    to authenticated using (is_admin()) with check (is_admin());

-- ---------- accounts ----------
create policy accounts_select on accounts for select to authenticated
  using (is_admin() or assigned_rep_id = auth.uid());
create policy accounts_insert on accounts for insert to authenticated
  with check (is_admin() or (is_active_user() and assigned_rep_id = auth.uid()));   -- reps add their own prospects
create policy accounts_update on accounts for update to authenticated
  using (is_admin() or assigned_rep_id = auth.uid())
  with check (is_admin() or assigned_rep_id = auth.uid());                          -- reps cannot hand accounts to others
create policy accounts_delete on accounts for delete to authenticated
  using (is_admin());

-- ---------- account_contacts ----------
create policy contacts_all on account_contacts for all to authenticated
  using (is_admin() or owns_account(account_id))
  with check (is_admin() or owns_account(account_id));

-- ---------- sales_activities ----------
create policy activities_select on sales_activities for select to authenticated
  using (is_admin() or rep_id = auth.uid() or owns_account(account_id));
create policy activities_insert on sales_activities for insert to authenticated
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy activities_update on sales_activities for update to authenticated
  using (is_admin() or (rep_id = auth.uid() and owns_account(account_id)))
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy activities_delete on sales_activities for delete to authenticated
  using (is_admin() or rep_id = auth.uid());

-- ---------- opportunities ----------
create policy opps_select on opportunities for select to authenticated
  using (is_admin() or rep_id = auth.uid() or owns_account(account_id));
create policy opps_insert on opportunities for insert to authenticated
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy opps_update on opportunities for update to authenticated
  using (is_admin() or rep_id = auth.uid() or owns_account(account_id))
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy opps_delete on opportunities for delete to authenticated
  using (is_admin() or owns_account(account_id));

-- ---------- promotions ----------
create policy promos_select on promotions for select to authenticated
  using (is_admin() or responsible_id = auth.uid()
         or exists (select 1 from promotion_accounts pa where pa.promotion_id = promotions.id and owns_account(pa.account_id)));
create policy promos_insert on promotions for insert to authenticated
  with check (is_admin() or (is_active_user() and responsible_id = auth.uid()));
create policy promos_update on promotions for update to authenticated
  using (is_admin() or responsible_id = auth.uid())
  with check (is_admin() or responsible_id = auth.uid());
create policy promos_delete on promotions for delete to authenticated
  using (is_admin() or responsible_id = auth.uid());

create policy promo_accounts_select on promotion_accounts for select to authenticated
  using (is_admin() or owns_account(account_id)
         or exists (select 1 from promotions p where p.id = promotion_id and p.responsible_id = auth.uid()));
create policy promo_accounts_write on promotion_accounts for all to authenticated
  using (is_admin() or (owns_account(account_id)
         and exists (select 1 from promotions p where p.id = promotion_id and p.responsible_id = auth.uid())))
  with check (is_admin() or (owns_account(account_id)
         and exists (select 1 from promotions p where p.id = promotion_id and p.responsible_id = auth.uid())));

-- ---------- competitor_tracking ----------
create policy comp_select on competitor_tracking for select to authenticated
  using (is_admin() or rep_id = auth.uid() or owns_account(account_id));
create policy comp_insert on competitor_tracking for insert to authenticated
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy comp_update on competitor_tracking for update to authenticated
  using (is_admin() or rep_id = auth.uid())
  with check (is_admin() or (rep_id = auth.uid() and owns_account(account_id)));
create policy comp_delete on competitor_tracking for delete to authenticated
  using (is_admin() or rep_id = auth.uid());

-- ---------- route planning ----------
create policy plans_select on route_plans for select to authenticated using (is_admin() or rep_id = auth.uid());
create policy plans_insert on route_plans for insert to authenticated with check (is_admin() or rep_id = auth.uid());
create policy plans_update on route_plans for update to authenticated using (is_admin() or rep_id = auth.uid()) with check (is_admin() or rep_id = auth.uid());
create policy plans_delete on route_plans for delete to authenticated using (is_admin() or rep_id = auth.uid());

create policy visits_select on route_visits for select to authenticated
  using (is_admin() or exists (select 1 from route_plans p where p.id = plan_id and p.rep_id = auth.uid()));
create policy visits_write on route_visits for all to authenticated
  using (is_admin() or exists (select 1 from route_plans p where p.id = plan_id and p.rep_id = auth.uid()))
  with check (is_admin() or (owns_account(account_id)
              and exists (select 1 from route_plans p where p.id = plan_id and p.rep_id = auth.uid())));

-- ---------- notifications ----------
create policy notif_select on notifications for select to authenticated using (user_id = auth.uid() or is_admin());
create policy notif_insert on notifications for insert to authenticated with check (is_admin() or user_id = auth.uid());
create policy notif_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on notifications for delete to authenticated using (user_id = auth.uid() or is_admin());

-- ---------- Storage bucket for competitor photos ----------
insert into storage.buckets (id, name, public) values ('competitor-attachments', 'competitor-attachments', false)
on conflict (id) do nothing;

create policy comp_files_read on storage.objects for select to authenticated
  using (bucket_id = 'competitor-attachments' and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
create policy comp_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'competitor-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy comp_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'competitor-attachments' and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text));
