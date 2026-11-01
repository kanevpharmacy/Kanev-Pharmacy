-- Delivery tracking hardening: one active route per driver and remove stale GPS after completion.
-- Existing assignments are retained; new conflicting assignments are rejected rather than silently cancelling work.

create or replace function public.kanev_enforce_one_active_driver_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('assigned','accepted','picked_up','in_transit') then
    if exists (
      select 1 from public.delivery_assignments a
      where a.driver_id = new.driver_id
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and a.status in ('assigned','accepted','picked_up','in_transit')
    ) then
      raise exception 'This driver already has an active delivery. Complete or reassign it before allocating another order.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kanev_one_active_driver_route on public.delivery_assignments;
create trigger kanev_one_active_driver_route
before insert or update of driver_id,status on public.delivery_assignments
for each row execute function public.kanev_enforce_one_active_driver_route();

create or replace function public.driver_update_delivery(
  p_assignment_id uuid,
  p_status text,
  p_note text default null
) returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.delivery_assignments;
  v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.delivery_drivers d where d.user_id=auth.uid() and d.status='active') then
    raise exception 'Active driver account required';
  end if;
  if p_status not in ('accepted','picked_up','in_transit','delivered') then
    raise exception 'Invalid delivery status';
  end if;
  update public.delivery_assignments a
  set status=p_status,
      accepted_at=case when p_status='accepted' then coalesce(a.accepted_at,now()) else a.accepted_at end,
      started_at=case when p_status in ('picked_up','in_transit') then coalesce(a.started_at,now()) else a.started_at end,
      delivered_at=case when p_status='delivered' then coalesce(a.delivered_at,now()) else a.delivered_at end,
      delivery_note=coalesce(p_note,a.delivery_note),updated_at=now()
  where a.id=p_assignment_id and a.driver_id=auth.uid() and a.status not in ('delivered','cancelled')
  returning a.* into v_row;
  if not found then raise exception 'Delivery assignment not found or already completed'; end if;
  if p_status='delivered' then
    update public.orders o set status='completed',delivery_status='delivered',
      delivered_at=coalesce(o.delivered_at,now()),updated_at=now()
    where o.id=v_row.order_id and o.fulfilment='delivery'
    returning o.id into v_order_id;
    if v_order_id is null then raise exception 'Delivery order could not be updated'; end if;
    insert into public.order_tracking_events(order_id,status,message,actor_id)
    values(v_order_id,'completed','Order delivered successfully by the assigned driver.',auth.uid());
    delete from public.delivery_driver_locations where driver_id=auth.uid();
  end if;
  return v_row;
end;
$$;
revoke all on function public.driver_update_delivery(uuid,text,text) from public, anon;
grant execute on function public.driver_update_delivery(uuid,text,text) to authenticated;

-- Remove positions belonging to suspended drivers; the background task checks status too.
delete from public.delivery_driver_locations l
using public.delivery_drivers d
where d.user_id=l.driver_id and d.status<>'active';
