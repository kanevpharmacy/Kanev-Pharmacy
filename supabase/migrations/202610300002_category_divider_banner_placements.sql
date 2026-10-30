-- Allow admin-managed promotional banners between selected homepage category rows.
-- Existing banner placements remain valid; this only extends the accepted placement values.
ALTER TABLE public.store_banners
  DROP CONSTRAINT IF EXISTS store_banners_placement_check;

ALTER TABLE public.store_banners
  ADD CONSTRAINT store_banners_placement_check
  CHECK (
    placement IN (
      'hero',
      'hero_side',
      'deal_tile',
      'editorial',
      'testimonial',
      'category_slot_2_3',
      'category_slot_5_6'
    )
  );
