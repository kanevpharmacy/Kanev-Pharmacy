-- Kanev Pharmacy login/registration branding typography controls
-- Run once in Supabase SQL Editor. Existing branding values remain unchanged.
ALTER TABLE public.app_login_branding
  ADD COLUMN IF NOT EXISTS left_heading_color text NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS left_heading_size integer NOT NULL DEFAULT 29,
  ADD COLUMN IF NOT EXISTS left_heading_style text NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS left_description_color text NOT NULL DEFAULT '#D8EAE2',
  ADD COLUMN IF NOT EXISTS left_description_size integer NOT NULL DEFAULT 13,
  ADD COLUMN IF NOT EXISTS left_description_style text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS benefit_color text NOT NULL DEFAULT '#F2FBF5',
  ADD COLUMN IF NOT EXISTS benefit_size integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS benefit_style text NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS brand_title_color text NOT NULL DEFAULT '#0B4B38',
  ADD COLUMN IF NOT EXISTS brand_title_size integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS brand_title_style text NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS tagline_color text NOT NULL DEFAULT '#246EB0',
  ADD COLUMN IF NOT EXISTS tagline_size integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tagline_style text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS right_eyebrow_color text NOT NULL DEFAULT '#16805B',
  ADD COLUMN IF NOT EXISTS right_eyebrow_size integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS right_eyebrow_style text NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS right_heading_color text NOT NULL DEFAULT '#172B24',
  ADD COLUMN IF NOT EXISTS right_heading_size integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS right_heading_style text NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS right_intro_color text NOT NULL DEFAULT '#718078',
  ADD COLUMN IF NOT EXISTS right_intro_size integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS right_intro_style text NOT NULL DEFAULT 'normal';

ALTER TABLE public.app_login_branding
  ADD COLUMN IF NOT EXISTS left_heading_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS left_description_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS benefit_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS brand_title_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS tagline_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS right_eyebrow_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS right_heading_font_family text NOT NULL DEFAULT 'System',
  ADD COLUMN IF NOT EXISTS right_intro_font_family text NOT NULL DEFAULT 'System';

ALTER TABLE public.app_login_branding
  ADD CONSTRAINT app_login_branding_font_styles_check
  CHECK (
    left_heading_style IN ('normal','bold','italic') AND
    left_description_style IN ('normal','bold','italic') AND
    benefit_style IN ('normal','bold','italic') AND
    brand_title_style IN ('normal','bold','italic') AND
    tagline_style IN ('normal','bold','italic') AND
    right_eyebrow_style IN ('normal','bold','italic') AND
    right_heading_style IN ('normal','bold','italic') AND
    right_intro_style IN ('normal','bold','italic')
  );
