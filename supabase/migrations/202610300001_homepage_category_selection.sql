-- Persist the administrator's ordered homepage category/subcategory selection.
-- Empty array preserves the existing automatic homepage section behaviour.
ALTER TABLE public.app_login_branding
  ADD COLUMN IF NOT EXISTS homepage_category_ids text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.app_login_branding.homepage_category_ids IS
  'Ordered store_menu_items IDs selected for homepage product sections (maximum 10).';
