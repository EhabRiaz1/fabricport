-- Per-buyer private fabrics. An admin marks a product private and lists the buyer
-- accounts allowed to see it; those buyers browse it from their Private Portal.
-- Sits alongside the older email-domain gate (product_private_domains), which stays.
create table if not exists public.product_private_buyers (
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, buyer_id)
);
create index if not exists product_private_buyers_buyer_idx
  on public.product_private_buyers (buyer_id);

alter table public.product_private_buyers enable row level security;
revoke all on public.product_private_buyers from anon;
-- products_public_read references this table, so anon needs SELECT for that policy
-- to plan at all (without it every anon product read fails). No anon policy exists,
-- so RLS still returns zero rows to anon.
grant select on public.product_private_buyers to anon;

drop policy if exists product_private_buyers_admin_all on public.product_private_buyers;
create policy product_private_buyers_admin_all on public.product_private_buyers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists product_private_buyers_buyer_read_own on public.product_private_buyers;
create policy product_private_buyers_buyer_read_own on public.product_private_buyers
  for select to authenticated
  using (buyer_id = (select auth.uid()));

create or replace function public.can_view_product(product_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.products p
    where p.id = product_uuid
      and (
        public.is_admin()
        or public.is_supplier_owner(p.supplier_id)
        or (
          p.status = 'published'
          and (
            p.visibility = 'public'
            or (
              auth.uid() is not null
              and (
                exists (
                  select 1 from public.product_private_domains ppd
                  where ppd.product_id = p.id
                    and ppd.domain = public.get_buyer_domain()
                )
                or exists (
                  select 1 from public.product_private_buyers ppb
                  where ppb.product_id = p.id
                    and ppb.buyer_id = auth.uid()
                )
              )
            )
          )
        )
      )
  );
$$;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated
  using (
    is_admin()
    or is_supplier_owner(supplier_id)
    or (
      status = 'published'
      and (
        visibility = 'public'
        or (
          (select auth.uid()) is not null
          and (
            exists (
              select 1 from public.product_private_domains ppd
              where ppd.product_id = products.id
                and ppd.domain = get_buyer_domain()
            )
            or exists (
              select 1 from public.product_private_buyers ppb
              where ppb.product_id = products.id
                and ppb.buyer_id = (select auth.uid())
            )
          )
        )
      )
    )
  );
