ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS summary text;
