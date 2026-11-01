-- Tighten driver write permissions: delivery progress must go through the validated RPC.
drop policy if exists "Drivers update own assignments" on public.delivery_assignments;

-- A driver may publish a location only against an assignment actually allocated to them.
drop policy if exists "Drivers manage own location" on public.delivery_driver_locations;
create policy "Drivers manage own location" on public.delivery_driver_locations
  for all to authenticated using (
    driver_id = auth.uid() and exists (
      select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active'
    )
  ) with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.delivery_drivers d where d.user_id = auth.uid() and d.status = 'active'
    )
    and (
      assignment_id is null
      or exists (
        select 1 from public.delivery_assignments a
        where a.id = assignment_id and a.driver_id = auth.uid()
          and a.status in ('picked_up','in_transit')
      )
    )
  );
