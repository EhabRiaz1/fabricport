-- WS5: the two columns the legacy import needs.
--
-- legacy_id makes the import idempotent — a re-run updates rather than duplicates.
-- Only products needs it: suppliers and buyers are matched on email, which is
-- already unique in auth.users.
alter table public.products add column if not exists legacy_id integer;
create unique index if not exists uq_products_legacy_id
  on public.products (legacy_id) where legacy_id is not null;

-- The legacy 3D is a CLO-SET *embed URL*, not a file. products.scan_files is jsonb
-- for binaries in a bucket that does not exist, so it is the wrong home — a URL
-- gets its own column.
alter table public.products add column if not exists model_embed_url text;

comment on column public.products.legacy_id is
  'fabricport.com/mscp ProductId. Set by the one-shot legacy import; null for products created in this app.';
comment on column public.products.model_embed_url is
  'External 3D viewer embed URL (CLO-SET). Distinct from scan_files, which is for uploaded binaries.';
