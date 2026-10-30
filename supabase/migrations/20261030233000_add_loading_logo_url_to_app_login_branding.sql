-- Add the configurable app startup logo to shared login branding.
alter table public.app_login_branding
  add column if not exists loading_logo_url text;

-- Refresh PostgREST so the new field is available to the admin portal immediately.
notify pgrst, 'reload schema';
