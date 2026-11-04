-- PG Growth Hub — schema
-- Run in the Supabase SQL editor (or `supabase db push`). Requires Postgres 15+ (Supabase default).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role        as enum ('rep', 'admin');
create type account_type     as enum ('Retail', 'Foodservice', 'Hotel', 'Institutional');
create type account_priority as enum ('A+', 'A', 'B', 'C');
create type account_status   as enum ('Prospect', 'Active', 'Inactive', 'On Hold');
create type territory_t      as enum ('North', 'Central', 'South', 'All');
create type activity_type_t  as enum ('Customer Visit','Phone Call','Email','Product Presentation','Product Sampling','Quotation','Negotiation','Follow-up','New Account Opening');
create type opp_stage        as enum ('Identified','Contacted','Sample Delivered','Quotation Submitted','Negotiation','Won','Lost');
create type promo_status     as enum ('Planned','Active','Completed','Cancelled');
create type visit_status     as enum ('Planned','Visited','Skipped');

-- ---------- shared trigger ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        user_role not null default 'rep',
  territory   territory_t not null default 'All',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- ---------- brands & products ----------
create table brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  supplier   text,
  created_at timestamptz not null default now()
);
create table products (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);
create index idx_products_brand on products(brand_id);

-- ---------- accounts ----------
create sequence account_no_seq start 1001;
create table accounts (
  id                 uuid primary key default gen_random_uuid(),
  account_no         text not null unique default ('PG-' || nextval('account_no_seq')),
  name               text not null,
  type               account_type not null default 'Retail',
  segment            text not null default 'Other',
  village            text not null,
  address            text,
  contact_name       text,
  contact_position   text,
  phone              text,
  email              text,
  assigned_rep_id    uuid references profiles(id) on delete set null,
  priority           account_priority not null default 'B',
  status             account_status not null default 'Prospect',
  monthly_potential  numeric(12,2) not null default 0 check (monthly_potential >= 0),
  monthly_sales      numeric(12,2) not null default 0 check (monthly_sales >= 0),
  current_products   text,
  potential_products text,
  competitor         text,
  last_visit         date,
  next_follow_up     date,
  notes              text,
  is_demo            boolean not null default false,
  created_by         uuid references profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_accounts_rep      on accounts(assigned_rep_id);
create index idx_accounts_type     on accounts(type);
create index idx_accounts_status   on accounts(status);
create index idx_accounts_priority on accounts(priority);
create index idx_accounts_village  on accounts(village);
create index idx_accounts_name     on accounts(lower(name));
create trigger trg_accounts_updated before update on accounts for each row execute function set_updated_at();

create table account_contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  position    text,
  phone       text,
  email       text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_contacts_account on account_contacts(account_id);
create trigger trg_contacts_updated before update on account_contacts for each row execute function set_updated_at();

-- ---------- sales activities ----------
create table sales_activities (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  rep_id          uuid not null references profiles(id) on delete restrict default auth.uid(),
  activity_type   activity_type_t not null,
  occurred_at     timestamptz not null default now(),
  summary         text not null,
  products        text,
  outcome         text,
  next_action     text,
  follow_up_date  date,
  follow_up_done  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_act_account  on sales_activities(account_id);
create index idx_act_rep      on sales_activities(rep_id);
create index idx_act_when     on sales_activities(occurred_at desc);
create index idx_act_followup on sales_activities(follow_up_date) where follow_up_date is not null and not follow_up_done;
create trigger trg_act_updated before update on sales_activities for each row execute function set_updated_at();

-- keep accounts.last_visit / next_follow_up in sync
create or replace function sync_account_from_activity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activity_type in ('Customer Visit','New Account Opening','Product Presentation','Product Sampling') then
    update accounts set last_visit = greatest(coalesce(last_visit, new.occurred_at::date), new.occurred_at::date) where id = new.account_id;
  end if;
  if new.follow_up_date is not null and not new.follow_up_done then
    update accounts set next_follow_up = new.follow_up_date where id = new.account_id;
  end if;
  return new;
end $$;
create trigger trg_act_sync after insert or update on sales_activities for each row execute function sync_account_from_activity();

-- ---------- opportunities ----------
create table opportunities (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  brand_id        uuid not null references brands(id),
  product_id      uuid references products(id) on delete set null,
  product_name    text not null,
  monthly_value   numeric(12,2) not null default 0 check (monthly_value >= 0),
  stage           opp_stage not null default 'Identified',
  probability     smallint not null default 10 check (probability between 0 and 100),
  expected_close  date,
  rep_id          uuid not null references profiles(id) on delete restrict default auth.uid(),
  next_action     text,
  notes           text,
  lost_reason     text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- weighted pipeline is computed by the database, never trusted from the client
  weighted_value  numeric(14,2) generated always as (
    case when stage in ('Won','Lost') then 0 else round(monthly_value * probability / 100.0, 2) end
  ) stored
);
create index idx_opp_account on opportunities(account_id);
create index idx_opp_rep     on opportunities(rep_id);
create index idx_opp_brand   on opportunities(brand_id);
create index idx_opp_stage   on opportunities(stage);
create trigger trg_opp_updated before update on opportunities for each row execute function set_updated_at();

-- ---------- promotions ----------
create table promotions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            text not null default 'Supplier Promotion',
  brand_id        uuid references brands(id),
  supplier        text,
  start_date      date not null,
  end_date        date not null,
  budget          numeric(12,2) not null default 0 check (budget >= 0),
  expected_results text,
  actual_results   text,
  status          promo_status not null default 'Planned',
  responsible_id  uuid references profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_promo_dates on promotions(start_date, end_date);
create index idx_promo_resp  on promotions(responsible_id);
create trigger trg_promo_updated before update on promotions for each row execute function set_updated_at();

create table promotion_accounts (
  promotion_id uuid not null references promotions(id) on delete cascade,
  account_id   uuid not null references accounts(id) on delete cascade,
  primary key (promotion_id, account_id)
);
create index idx_promo_acct on promotion_accounts(account_id);

-- ---------- competitor tracking ----------
create table competitor_tracking (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete cascade,
  rep_id           uuid not null references profiles(id) on delete restrict default auth.uid(),
  competitor_name  text not null,
  products         text,
  selling_price    text,
  promotions       text,
  current_supplier text,
  observations     text,
  recorded_on      date not null default current_date,
  attachment_path  text,   -- path in the 'competitor-attachments' Storage bucket
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_comp_account on competitor_tracking(account_id);
create index idx_comp_rep     on competitor_tracking(rep_id);
create trigger trg_comp_updated before update on competitor_tracking for each row execute function set_updated_at();

-- ---------- route planning ----------
create table route_plans (
  id          uuid primary key default gen_random_uuid(),
  plan_date   date not null,
  rep_id      uuid not null references profiles(id) on delete cascade default auth.uid(),
  territory   territory_t not null default 'All',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_rp_rep_date on route_plans(rep_id, plan_date);
create trigger trg_rp_updated before update on route_plans for each row execute function set_updated_at();

create table route_visits (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references route_plans(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  status      visit_status not null default 'Planned',
  outcome     text,
  visited_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (plan_id, account_id)
);
create index idx_rv_plan    on route_visits(plan_id);
create index idx_rv_account on route_visits(account_id);
create trigger trg_rv_updated before update on route_visits for each row execute function set_updated_at();

-- ---------- notifications ----------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notif_user on notifications(user_id, read_at);

-- ---------- reference data ----------
insert into brands (name, supplier) values
  ('Agrosuper', 'Agrosuper'), ('Hostess', 'Hostess Brands'), ('Kikkoman', 'Kikkoman');

insert into products (brand_id, name)
select b.id, p.name from brands b join (values
  ('Agrosuper','Party Wings'), ('Agrosuper','Drummettes'), ('Agrosuper','Chicken Breast'),
  ('Agrosuper','Leg Quarters'), ('Agrosuper','Thighs'), ('Agrosuper','Whole Chicken'),
  ('Hostess','Product Placement'), ('Hostess','New SKU'), ('Hostess','Shelf Display'),
  ('Hostess','Endcap'), ('Hostess','Promotional Campaign'),
  ('Kikkoman','Soy Sauce'), ('Kikkoman','Teriyaki Sauce'), ('Kikkoman','Foodservice Soy Sauce'),
  ('Kikkoman','Panko'), ('Kikkoman','Other Kikkoman')
) as p(brand, name) on p.brand = b.name;

-- ---------- new auth user -> profile ----------
-- New sign-ups are ALWAYS 'rep'. An existing admin promotes users (see 002_rls.sql).
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from profiles) into first_user;
  insert into profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email,
          case when first_user then 'admin'::user_role else 'rep'::user_role end);  -- first user bootstraps as admin
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
