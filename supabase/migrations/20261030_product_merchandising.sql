-- Product merchandising fields for storefront ratings and sale pricing.
-- The selling price remains products.price_zmw. original_price_zmw is the
-- optional pre-discount/list price; the discount percentage is calculated.
alter table public.products
  add column if not exists original_price_zmw numeric(12,2),
  add column if not exists rating numeric(2,1) not null default 5.0;

alter table public.products
  add constraint products_rating_range_check
  check (rating >= 0 and rating <= 5) not valid;

alter table public.products
  validate constraint products_rating_range_check;
