-- Kanev Pharmacy: add a dedicated storefront header logo to existing branding settings.
-- Run once in Supabase SQL Editor. This preserves all current branding fields and rows.
ALTER TABLE public.app_login_branding
  ADD COLUMN IF NOT EXISTS header_logo_url text NOT NULL DEFAULT '';
