create extension if not exists pgcrypto;

do $$ begin
  create type public.kanev_order_status as enum
  ('pending_review','confirmed','preparing','ready_for_collection','out_for_delivery','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kanev_fulfilment as enum ('delivery','collection');
exception when duplicate_object then null; end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  brand text,
  sku text unique,
  barcode text,
  image_url text,
  price_zmw numeric(12,2) not null default 0 check (price_zmw >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  expiry_date date,
  requires_prescription boolean not null default false,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text,
  fulfilment public.kanev_fulfilment not null,
  status public.kanev_order_status not null default 'pending_review',
  subtotal_zmw numeric(12,2) not null default 0 check (subtotal_zmw >= 0),
  delivery_fee_zmw numeric(12,2) not null default 0 check (delivery_fee_zmw >= 0),
  total_zmw numeric(12,2) not null default 0 check (total_zmw >= 0),
  prescription_review_status text not null default 'not_required'
    check (prescription_review_status in ('not_required','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_zmw numeric(12,2) not null check (unit_price_zmw >= 0),
  quantity integer not null check (quantity > 0),
  line_total_zmw numeric(12,2) not null check (line_total_zmw >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.kanev_order_status,
  new_status public.kanev_order_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','pharmacist','staff','fulfilment')),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.admin_members enable row level security;

drop policy if exists "Public reads active categories" on public.categories;
create policy "Public reads active categories" on public.categories
for select using (is_active = true);

drop policy if exists "Public reads active products" on public.products;
create policy "Public reads active products" on public.products
for select using (is_active = true);

drop policy if exists "Customer reads own profile" on public.customer_profiles;
create policy "Customer reads own profile" on public.customer_profiles
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Customer inserts own profile" on public.customer_profiles;
create policy "Customer inserts own profile" on public.customer_profiles
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Customer updates own profile" on public.customer_profiles;
create policy "Customer updates own profile" on public.customer_profiles
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.categories(name,slug,icon) values
 ('Medicines','medicines','medkit-outline'),
 ('Skincare','skincare','water-outline'),
 ('Baby Care','baby-care','happy-outline'),
 ('Personal Care','personal-care','sparkles-outline'),
 ('Wellness','wellness','fitness-outline'),
 ('Medical Supplies','medical-supplies','bandage-outline')
on conflict (slug) do nothing;

-- Deliberately no public product write or order write policies.
-- Writes must go through a server-side function that validates user, price, stock and roles.
