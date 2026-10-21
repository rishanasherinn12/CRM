-- =====================================================================
-- CRM schema for Supabase
-- Run this whole file in the Supabase SQL Editor (Dashboard > SQL Editor).
-- It is safe to re-run: objects are dropped/recreated where needed.
-- =====================================================================

-- ---------- Types ----------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'sales');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('New', 'Contacted', 'Interested', 'Converted', 'Lost');
exception when duplicate_object then null; end $$;

-- ---------- Tables ---------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        public.user_role not null default 'sales',
  created_at  timestamptz not null default now()
);

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  phone        text,
  company      text,
  source       text,
  status       public.lead_status not null default 'New',
  value        numeric(12, 2) not null default 0,
  notes        text,
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  due_date    date not null,
  note        text,
  completed   boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  company     text,
  address     text,
  notes       text,
  lead_id     uuid references public.leads (id) on delete set null,
  owner_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customers (id) on delete set null,
  product        text not null,
  amount         numeric(12, 2) not null check (amount >= 0),
  sale_date      date not null default current_date,
  notes          text,
  sales_exec_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

create index if not exists leads_assigned_to_idx     on public.leads (assigned_to);
create index if not exists leads_status_idx          on public.leads (status);
create index if not exists follow_ups_lead_id_idx    on public.follow_ups (lead_id);
create index if not exists follow_ups_due_date_idx   on public.follow_ups (due_date);
create index if not exists customers_owner_id_idx    on public.customers (owner_id);
create index if not exists sales_sales_exec_id_idx   on public.sales (sales_exec_id);
create index if not exists sales_customer_id_idx     on public.sales (customer_id);

-- ---------- Helper functions ----------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile automatically for every new auth user.
-- New sign-ups are always Sales Executives; promote admins with SQL (see README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'sales'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change a role. Direct SQL (no auth.uid()) is allowed so you can bootstrap the first admin.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security --------------------------------------
alter table public.profiles   enable row level security;
alter table public.leads      enable row level security;
alter table public.follow_ups enable row level security;
alter table public.customers  enable row level security;
alter table public.sales      enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- leads: sales executives see and manage only leads assigned to them
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select to authenticated
  using (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert to authenticated
  with check (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update to authenticated
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());

drop policy if exists "leads_delete" on public.leads;
create policy "leads_delete" on public.leads
  for delete to authenticated
  using (public.is_admin() or assigned_to = auth.uid());

-- follow_ups: access follows access to the parent lead
drop policy if exists "follow_ups_all" on public.follow_ups;
create policy "follow_ups_all" on public.follow_ups
  for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()
    )
  );

-- customers
drop policy if exists "customers_all" on public.customers;
create policy "customers_all" on public.customers
  for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

-- sales
drop policy if exists "sales_all" on public.sales;
create policy "sales_all" on public.sales
  for all to authenticated
  using (public.is_admin() or sales_exec_id = auth.uid())
  with check (public.is_admin() or sales_exec_id = auth.uid());

-- ---------- Grants ---------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.leads, public.follow_ups, public.customers, public.sales to authenticated;
grant select, update on public.profiles to authenticated;
grant execute on function public.is_admin() to authenticated;
