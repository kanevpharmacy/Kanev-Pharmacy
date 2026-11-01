-- Break circular RLS evaluation between orders and delivery tables.
-- SECURITY DEFINER helpers run as the migration owner and deliberately bypass
-- table RLS while still checking the authenticated user's ownership/assignment.
create or replace function public.kanev_customer_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.customer_id = auth.uid()
  );
$$;

create or replace function public.kanev_driver_assigned_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_assignments a
    join public.delivery_drivers d on d.user_id = a.driver_id
    where a.order_id = p_order_id
      and a.driver_id = auth.uid()
      and d.status = 'active'
      and a.status <> 'cancelled'
  );
$$;

create or replace function public.kanev_customer_can_read_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_assignments a
    join public.orders o on o.id = a.order_id
    where a.id = p_assignment_id
      and o.customer_id = auth.uid()
      and a.status in ('accepted','picked_up','in_transit','delivered')
  );
$$;

create or replace function public.kanev_customer_can_read_driver_location(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.delivery_assignments a
    join public.orders o on o.id = a.order_id
    where a.id = p_assignment_id
      and o.customer_id = auth.uid()
      and a.status in ('accepted','picked_up','in_transit')
  );
$$;

revoke all on function public.kanev_customer_owns_order(uuid) from public, anon;
revoke all on function public.kanev_driver_assigned_to_order(uuid) from public, anon;
revoke all on function public.kanev_customer_can_read_assignment(uuid) from public, anon;
revoke all on function public.kanev_customer_can_read_driver_location(uuid) from public, anon;
grant execute on function public.kanev_customer_owns_order(uuid) to authenticated;
grant execute on function public.kanev_driver_assigned_to_order(uuid) to authenticated;
grant execute on function public.kanev_customer_can_read_assignment(uuid) to authenticated;
grant execute on function public.kanev_customer_can_read_driver_location(uuid) to authenticated;

-- The old policies queried each other through RLS and caused infinite recursion.
drop policy if exists "Drivers read assigned orders" on public.orders;
create policy "Drivers read assigned orders" on public.orders
  for select to authenticated
  using (public.kanev_driver_assigned_to_order(id));

drop policy if exists "Customers read active delivery assignment" on public.delivery_assignments;
create policy "Customers read active delivery assignment" on public.delivery_assignments
  for select to authenticated
  using (public.kanev_customer_can_read_assignment(id));

drop policy if exists "Customers read assigned driver location" on public.delivery_driver_locations;
create policy "Customers read assigned driver location" on public.delivery_driver_locations
  for select to authenticated
  using (public.kanev_customer_can_read_driver_location(assignment_id));
