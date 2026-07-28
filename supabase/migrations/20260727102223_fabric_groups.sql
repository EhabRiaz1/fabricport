-- WS4: colour grouping. A fabric_group is the colourless parent ("Zephyr"); the
-- products that link to it are its colourways. All 205 seeded products stay
-- ungrouped (fabric_group_id null) and render exactly as before -- the switcher
-- simply does not appear for them.

create table if not exists public.fabric_groups (
  id uuid primary key default gen_random_uuid(),
  -- A colourway family belongs to exactly one supplier. Denormalized here (rather
  -- than inferred from members) so the guard below can be a cheap lookup and an
  -- empty group still has an owner.
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  title text not null,
  slug text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fabric_groups_supplier on public.fabric_groups (supplier_id);

alter table public.fabric_groups enable row level security;

drop trigger if exists set_fabric_groups_updated_at on public.fabric_groups;
create trigger set_fabric_groups_updated_at before update on public.fabric_groups
  for each row execute function public.set_updated_at();

-- Readable by anyone: the colour switcher runs on the PUBLIC fabric detail page,
-- so a logged-out visitor must be able to resolve sibling colourways.
drop policy if exists fabric_groups_public_read on public.fabric_groups;
create policy fabric_groups_public_read on public.fabric_groups
  for select to anon, authenticated using (true);

drop policy if exists fabric_groups_owner_write on public.fabric_groups;
create policy fabric_groups_owner_write on public.fabric_groups
  for all to authenticated
  using (public.is_supplier_owner(supplier_id) or public.is_admin())
  with check (public.is_supplier_owner(supplier_id) or public.is_admin());

alter table public.products add column if not exists fabric_group_id uuid
  references public.fabric_groups(id) on delete set null;
create index if not exists idx_products_fabric_group on public.products (fabric_group_id);

-- fabric_group_id is deliberately NOT in guard_product_admin_columns' denylist --
-- suppliers are meant to group their own fabrics. But without this check a
-- supplier could file their product under a COMPETITOR's group and appear inside
-- that supplier's colour switcher.
create or replace function public.guard_product_fabric_group()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if new.fabric_group_id is null then return new; end if;
  select supplier_id into v_owner from public.fabric_groups where id = new.fabric_group_id;
  if v_owner is distinct from new.supplier_id then
    raise exception 'a product can only join a fabric group owned by its own supplier'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_fabric_group on public.products;
create trigger products_guard_fabric_group
  before insert or update of fabric_group_id, supplier_id on public.products
  for each row execute function public.guard_product_fabric_group();

revoke execute on function public.guard_product_fabric_group() from public, anon, authenticated;
