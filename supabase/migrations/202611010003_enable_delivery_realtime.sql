-- Ensure Supabase Realtime can stream driver position changes to authorised subscribers.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_driver_locations'
  ) then
    alter publication supabase_realtime add table public.delivery_driver_locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'delivery_assignments'
  ) then
    alter publication supabase_realtime add table public.delivery_assignments;
  end if;
end $$;
