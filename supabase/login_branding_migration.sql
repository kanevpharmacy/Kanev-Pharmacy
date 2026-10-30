-- Kanev Pharmacy: editable customer login / registration branding
-- Run once in Supabase SQL Editor. This table stores visual configuration only.
create table if not exists public.app_login_branding (
  id text primary key default 'default' check (id = 'default'),
  pharmacy_title text not null default 'Kanev Pharmacy',
  tagline text not null default 'Closer to Your Health',
  logo_left_url text not null default '',
  logo_form_url text not null default '',
  left_background_image_url text not null default '',
  left_background_color text not null default '#0B4B38',
  left_heading text not null default 'Closer to your health.',
  left_description text not null default 'Everyday essentials, trusted pharmacy care and a simpler way to look after your family.',
  benefit_one text not null default 'Your account, handled securely',
  benefit_two text not null default 'Keep track of your orders',
  benefit_three text not null default 'Care for every day',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.app_login_branding (id) values ('default') on conflict (id) do nothing;
alter table public.app_login_branding enable row level security;
drop policy if exists "Anyone can read login branding" on public.app_login_branding;
create policy "Anyone can read login branding" on public.app_login_branding for select using (true);
drop policy if exists "Authorized pharmacy admins update login branding" on public.app_login_branding;
create policy "Authorized pharmacy admins update login branding" on public.app_login_branding for update to authenticated using (exists (select 1 from public.admin_members am where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff'))) with check (exists (select 1 from public.admin_members am where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')));
drop policy if exists "Authorized pharmacy admins insert login branding" on public.app_login_branding;
create policy "Authorized pharmacy admins insert login branding" on public.app_login_branding for insert to authenticated with check (exists (select 1 from public.admin_members am where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')));
grant select on public.app_login_branding to anon, authenticated;
grant insert, update on public.app_login_branding to authenticated;

-- Publicly readable assets are needed because the customer login appears before sign-in.
-- Only authorised pharmacy management roles may upload, replace, or delete branding assets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('login-branding', 'login-branding', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Public can view Kanev login branding assets" on storage.objects;
create policy "Public can view Kanev login branding assets"
on storage.objects for select
using (bucket_id = 'login-branding');

drop policy if exists "Kanev admins upload login branding assets" on storage.objects;
create policy "Kanev admins upload login branding assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'login-branding' and exists (
  select 1 from public.admin_members am
  where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')
));

drop policy if exists "Kanev admins replace login branding assets" on storage.objects;
create policy "Kanev admins replace login branding assets"
on storage.objects for update to authenticated
using (bucket_id = 'login-branding' and exists (
  select 1 from public.admin_members am
  where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')
))
with check (bucket_id = 'login-branding' and exists (
  select 1 from public.admin_members am
  where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')
));

drop policy if exists "Kanev admins delete login branding assets" on storage.objects;
create policy "Kanev admins delete login branding assets"
on storage.objects for delete to authenticated
using (bucket_id = 'login-branding' and exists (
  select 1 from public.admin_members am
  where am.user_id = auth.uid() and am.role in ('owner','pharmacist','staff')
));
