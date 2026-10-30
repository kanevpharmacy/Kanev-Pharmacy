-- Kanev Pharmacy: persist and display the header/storefront logo.
-- Run this in the Supabase SQL Editor before using the updated files.

alter table public.app_login_branding
  add column if not exists header_logo_url text;

-- The app uses getPublicUrl(), so this bucket must be public for the logo to render.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'login-branding',
  'login-branding',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public can read images from the public branding bucket.
drop policy if exists "Public can view Kanev login branding images" on storage.objects;
create policy "Public can view Kanev login branding images"
on storage.objects for select
to public
using (bucket_id = 'login-branding');

-- Only authenticated administrators can upload or update branding images.
drop policy if exists "Kanev admins can upload login branding images" on storage.objects;
create policy "Kanev admins can upload login branding images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'login-branding'
  and exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff')
  )
);

drop policy if exists "Kanev admins can update login branding images" on storage.objects;
create policy "Kanev admins can update login branding images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'login-branding'
  and exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff')
  )
)
with check (
  bucket_id = 'login-branding'
  and exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff')
  )
);

drop policy if exists "Kanev admins can delete login branding images" on storage.objects;
create policy "Kanev admins can delete login branding images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'login-branding'
  and exists (
    select 1 from public.admin_members am
    where am.user_id = auth.uid()
      and am.role in ('owner','pharmacist','staff')
  )
);

-- The app_login_branding table must already have RLS policies that allow
-- these admin users to upsert the default row.
