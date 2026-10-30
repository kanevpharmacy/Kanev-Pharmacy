-- Customer read access for their own orders only.
-- Safe to run in Supabase SQL Editor after the base schema.

 drop policy if exists "Customers read own orders" on public.orders;
 create policy "Customers read own orders" on public.orders
   for select to authenticated using (auth.uid() = customer_id);

 drop policy if exists "Customers read own order items" on public.order_items;
 create policy "Customers read own order items" on public.order_items
   for select to authenticated using (
     exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
   );

 drop policy if exists "Customers read own order events" on public.order_status_events;
 create policy "Customers read own order events" on public.order_status_events
   for select to authenticated using (
     exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
   );
