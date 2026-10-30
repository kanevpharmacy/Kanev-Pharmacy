-- Run only after creating your own account and replacing the email below.
-- This records the owner role; production admin APIs must enforce this role server-side.
insert into public.admin_members(user_id, role)
select id, 'owner' from auth.users where email = 'YOUR_ADMIN_EMAIL'
on conflict (user_id) do update set role = excluded.role;
