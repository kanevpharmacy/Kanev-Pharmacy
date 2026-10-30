-- Store multiple product images while preserving image_url as the primary/legacy image.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill existing primary images into the gallery without overwriting existing galleries.
UPDATE public.products
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND btrim(image_url) <> ''
  AND COALESCE(array_length(image_urls, 1), 0) = 0;
