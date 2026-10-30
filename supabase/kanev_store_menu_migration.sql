-- Kanev Pharmacy: database-driven, nested storefront navigation
-- Run once in Supabase SQL Editor. This does not alter products or categories.

create table if not exists public.store_menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) between 1 and 80),
  slug text unique,
  parent_id uuid null references public.store_menu_items(id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  destination_type text not null default 'category' check (destination_type in ('category','all','url')),
  destination_value text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_menu_items_parent_order_idx
  on public.store_menu_items(parent_id, sort_order);

alter table public.store_menu_items enable row level security;

drop policy if exists "Storefront can read active menu items" on public.store_menu_items;
create policy "Storefront can read active menu items"
  on public.store_menu_items for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Kanev admins manage store menu" on public.store_menu_items;
create policy "Kanev admins manage store menu"
  on public.store_menu_items for all to authenticated
  using (exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff','fulfilment')
  ))
  with check (exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff','fulfilment')
  ));

-- Prevent cyclic parent relationships (e.g. A > B > A).
create or replace function public.prevent_store_menu_cycle()
returns trigger language plpgsql as $$
declare
  cycle_found boolean;
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then
    raise exception 'A menu item cannot be its own parent';
  end if;
  with recursive descendants(id) as (
    select new.id
    union all
    select m.id from public.store_menu_items m join descendants d on m.parent_id = d.id
    where m.id <> new.id
  )
  select exists(select 1 from descendants where id = new.parent_id) into cycle_found;
  if cycle_found then raise exception 'This parent would create a menu cycle'; end if;
  return new;
end;
$$;
drop trigger if exists store_menu_items_prevent_cycle on public.store_menu_items;
create trigger store_menu_items_prevent_cycle
before insert or update of parent_id on public.store_menu_items
for each row execute function public.prevent_store_menu_cycle();

-- Seed the current top-level navigation so the existing storefront menu is retained.
insert into public.store_menu_items (label, slug, parent_id, sort_order, is_active, destination_type, destination_value)
values
 ('Medicines','medicines',null,10,true,'category','Medicines'),
 ('Personal Care','personal-care',null,20,true,'category','Personal Care'),
 ('Wellness','wellness',null,30,true,'category','Wellness'),
 ('Baby Care','baby-care',null,40,true,'category','Baby Care'),
 ('Skincare','skincare',null,50,true,'category','Skincare'),
 ('Medical Supplies','medical-supplies',null,60,true,'category','Medical Supplies')
on conflict (slug) do nothing;
