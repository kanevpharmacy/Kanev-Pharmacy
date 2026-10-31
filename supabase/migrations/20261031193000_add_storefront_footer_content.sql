-- Storefront footer content is managed from the admin portal.
ALTER TABLE public.app_login_branding
  ADD COLUMN IF NOT EXISTS footer_content jsonb NOT NULL DEFAULT '{}'::jsonb;
