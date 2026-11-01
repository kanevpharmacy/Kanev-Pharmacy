-- Kanev Pharmacy driver accounts, assignments and private live-location tracking.
create table if not exists public.delivery_drivers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(user_id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned','accepted','picked_up','in_transit','delivered','cancelled')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  proof_of_delivery_url text,
  delivery_note text,
  updated_at timestamptz not null default now(),
  constraint delivery_assignments_one_active_order unique (order_id)
);

create table if not exists public.delivery_driver_locations (
  driver_id uuid primary key references public.delivery_drivers(user_id) on delete cascade,
  assignment_id uuid references public.delivery_assignments(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  heading double precision,
  speed_mps double precision,
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

create index if not exists delivery_assignments_driver_status_idx
  on public.delivery_assignments(driver_id,status);
create index if not exists delivery_assignments_order_idx
  on public.delivery_assignments(order_id);
create index if not exists delivery_driver_locations_assignment_idx
  on public.delivery_driver_locations(assignment_id);

alter table public.delivery_drivers enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_driver_locations enable row level security;

create or replace function public.is_kanev_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_members am where am.user_id = auth.uid());
$$;
revoke all on function public.is_kanev_admin() from public, anon;
grant execute on function public.is_kanev_admin() to authenticated;

drop policy if exists "Admins manage delivery drivers" on public.delivery_drivers;
create policy "Admins manage delivery drivers" on public.delivery_drivers
  for all to authenticated using (public.is_kanev_admin()) with check (public.is_kanev_admin());
drop policy if exists "Drivers read own driver profile" on public.delivery_drivers;
create policy "Drivers read own driver profile" on public.delivery_drivers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins manage delivery assignments" on public.delivery_assignments;
create policy "Admins manage delivery assignments" on public.delivery_assignments
  for all to authenticated using (public.is_kanev_admin()) with check (public.is_kanev_admin());
drop policy if exists "Drivers read own assignments" on public.delivery_assignments;
create policy "Drivers read own assignments" on public.delivery_assignments
  for select to authenticated using (driver_id = auth.uid());
drop policy if exists "Drivers update own assignments" on public.delivery_assignments;
create policy "Drivers update own assignments" on public.delivery_assignments
  for update to authenticated using (
    driver_id = auth.uid() and exists (
      select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active'
    )
  ) with check (driver_id = auth.uid());

drop policy if exists "Admins read driver locations" on public.delivery_driver_locations;
create policy "Admins read driver locations" on public.delivery_driver_locations
  for select to authenticated using (public.is_kanev_admin());
drop policy if exists "Drivers manage own location" on public.delivery_driver_locations;
create policy "Drivers manage own location" on public.delivery_driver_locations
  for all to authenticated using (
    driver_id = auth.uid() and exists (
      select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active'
    )
  ) with check (
    driver_id = auth.uid() and exists (
      select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active'
    )
  );
drop policy if exists "Customers read assigned driver location" on public.delivery_driver_locations;
create policy "Customers read assigned driver location" on public.delivery_driver_locations
  for select to authenticated using (
    exists (
      select 1 from public.delivery_assignments a
      join public.orders o on o.id = a.order_id
      where a.id = assignment_id and o.customer_id = auth.uid()
        and a.status in ('accepted','picked_up','in_transit')
    )
  );

-- Drivers can only read the order allocated to them.
drop policy if exists "Drivers read assigned orders" on public.orders;
create policy "Drivers read assigned orders" on public.orders
  for select to authenticated using (
    exists (
      select 1 from public.delivery_assignments a
      join public.delivery_drivers d on d.user_id = a.driver_id
      where a.order_id = orders.id and a.driver_id = auth.uid()
        and d.status = 'active' and a.status not in ('cancelled')
    )
  );

-- Drivers can update only delivery progress fields through this constrained RPC.
create or replace function public.driver_update_delivery(
  p_assignment_id uuid,
  p_status text,
  p_note text default null
) returns public.delivery_assignments
language plpgsql security definer set search_path = ''
as $$
declare v_row public.delivery_assignments;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active') then
    raise exception 'Active driver account required';
  end if;
  if p_status not in ('accepted','picked_up','in_transit','delivered') then
    raise exception 'Invalid delivery status';
  end if;
  update public.delivery_assignments a
    set status = p_status,
        accepted_at = case when p_status = 'accepted' then coalesce(a.accepted_at,now()) else a.accepted_at end,
        started_at = case when p_status in ('picked_up','in_transit') then coalesce(a.started_at,now()) else a.started_at end,
        delivered_at = case when p_status = 'delivered' then now() else a.delivered_at end,
        delivery_note = coalesce(p_note,a.delivery_note),
        updated_at = now()
    where a.id = p_assignment_id and a.driver_id = auth.uid()
    returning a.* into v_row;
  if not found then raise exception 'Delivery assignment not found'; end if;
  return v_row;
end;
$$;
revoke all on function public.driver_update_delivery(uuid,text,text) from public, anon;
grant execute on function public.driver_update_delivery(uuid,text,text) to authenticated;

-- Customer tracking is available only while the assigned delivery is active.
drop policy if exists "Customers read active delivery assignment" on public.delivery_assignments;
create policy "Customers read active delivery assignment" on public.delivery_assignments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
    and status in ('accepted','picked_up','in_transit','delivered')
  );

alter table public.delivery_assignments replica identity full;
alter table public.delivery_driver_locations replica identity full;
