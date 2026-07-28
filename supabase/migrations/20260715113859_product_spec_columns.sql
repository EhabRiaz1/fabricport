-- W2b: Promote hot spec fields to real columns so they can be filtered server-side.
-- GSM/width/composition are backfilled from products.json (see scripts/backfill-specs.ts).
-- sample_available defaults false; suppliers set it via the supplier edit screen (W3).
alter table public.products
  add column if not exists gsm numeric,
  add column if not exists width_inches numeric,
  add column if not exists composition text,
  add column if not exists sample_available boolean not null default false;

-- GSM range filtering is the one spec filter wired server-side today.
create index if not exists products_gsm_idx on public.products (gsm) where status = 'published';
