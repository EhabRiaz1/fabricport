-- W3b: Private catalogues shared by unguessable link, alongside the existing
-- email-domain gate. share_token is a 48-char hex string (path-safe).
create table if not exists public.catalogues (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  share_token text unique not null default encode(extensions.gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.catalogue_products (
  catalogue_id uuid not null references public.catalogues(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (catalogue_id, product_id)
);
create index if not exists catalogue_products_product_idx on public.catalogue_products (product_id);

alter table public.catalogues enable row level security;
alter table public.catalogue_products enable row level security;

-- Only the owning supplier (or an admin) can see/manage catalogues. There is NO
-- anon policy: a share token must never be selectable from the table, or the
-- public anon key could enumerate every private link. Public access is via the
-- get_catalogue RPC only.
drop policy if exists catalogues_owner on public.catalogues;
create policy catalogues_owner on public.catalogues
  for all
  using (is_supplier_owner(supplier_id) or is_admin())
  with check (is_supplier_owner(supplier_id) or is_admin());

drop policy if exists catalogue_products_owner on public.catalogue_products;
create policy catalogue_products_owner on public.catalogue_products
  for all
  using (exists (
    select 1 from public.catalogues c
    where c.id = catalogue_id and (is_supplier_owner(c.supplier_id) or is_admin())
  ))
  with check (exists (
    select 1 from public.catalogues c
    where c.id = catalogue_id and (is_supplier_owner(c.supplier_id) or is_admin())
  ));

revoke all on public.catalogues from anon;
revoke all on public.catalogue_products from anon;

-- Public read of a catalogue by token. SECURITY DEFINER bypasses RLS; it returns
-- the catalogue + its products only when the token is active and unexpired.
-- Returns null (indistinguishable for revoked / expired / unknown) otherwise.
create or replace function public.get_catalogue(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'supplier', jsonb_build_object(
      'brand_name', s.brand_name, 'slug', s.slug, 'is_verified', s.is_verified
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'slug', p.slug, 'images', p.images,
        'gsm', p.gsm, 'width_inches', p.width_inches, 'composition', p.composition,
        'price_min_pkr', p.price_min_pkr, 'price_max_pkr', p.price_max_pkr,
        'price_min_usd', p.price_min_usd, 'price_max_usd', p.price_max_usd,
        'stock_meters', p.stock_meters, 'moq_meters', p.moq_meters,
        'lead_time_days', p.lead_time_days, 'color_hex', p.color_hex
      ) order by p.title)
      from public.catalogue_products cp
      join public.products p on p.id = cp.product_id
      where cp.catalogue_id = c.id
    ), '[]'::jsonb)
  )
  from public.catalogues c
  join public.suppliers s on s.id = c.supplier_id
  where c.share_token = p_token
    and c.is_active
    and (c.expires_at is null or c.expires_at > now());
$$;

grant execute on function public.get_catalogue(text) to anon, authenticated;
