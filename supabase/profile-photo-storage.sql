-- Kanev Pharmacy customer profile photo storage
-- Run once in Supabase SQL Editor. This creates a public image bucket and limits uploads/updates/deletes to the signed-in user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-avatars', 'customer-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Customer avatars are publicly viewable" on storage.objects;
create policy "Customer avatars are publicly viewable"
on storage.objects for select using (bucket_id = 'customer-avatars');

drop policy if exists "Customers upload their own avatar" on storage.objects;
create policy "Customers upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Customers update their own avatar" on storage.objects;
create policy "Customers update their own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Customers delete their own avatar" on storage.objects;
create policy "Customers delete their own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
