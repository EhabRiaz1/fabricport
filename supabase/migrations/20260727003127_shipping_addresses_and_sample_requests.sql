-- WS2 part 1: the address book and the sample-request flow. The messages/chat
-- extension is deliberately a SEPARATE migration -- it touches live buyer<->supplier
-- chat and is isolated so it can be reasoned about (and reverted) on its own.

-- ============================================================ shipping_addresses
create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  province text,
  postal_code text,
  country text not null default 'PK',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipping_addresses_buyer on public.shipping_addresses (buyer_id);
-- At most one default per buyer.
create unique index if not exists uq_shipping_addresses_one_default
  on public.shipping_addresses (buyer_id) where is_default;

alter table public.shipping_addresses enable row level security;
revoke all on public.shipping_addresses from anon;

drop trigger if exists set_shipping_addresses_updated_at on public.shipping_addresses;
create trigger set_shipping_addresses_updated_at before update on public.shipping_addresses
  for each row execute function public.set_updated_at();

-- Buyer owns their own book; admin can see all. Suppliers are NOT a party here --
-- they only ever see the ship_to snapshot copied onto a request they're fulfilling.
drop policy if exists shipping_addresses_owner_all on public.shipping_addresses;
create policy shipping_addresses_owner_all on public.shipping_addresses
  for all to authenticated
  using (buyer_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or public.is_admin());

-- ============================================================== sample_requests
create table if not exists public.sample_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested','approved','shipped','delivered','declined','cancelled')),
  -- SNAPSHOT, not an FK: a later edit to the address book must never rewrite the
  -- address a parcel was actually sent to.
  ship_to jsonb not null,
  courier text,
  tracking_number text,
  buyer_notes text,
  supplier_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sample_requests_buyer
  on public.sample_requests (buyer_id, created_at desc);
create index if not exists idx_sample_requests_supplier
  on public.sample_requests (supplier_id, created_at desc);

alter table public.sample_requests enable row level security;
revoke all on public.sample_requests from anon;

drop trigger if exists set_sample_requests_updated_at on public.sample_requests;
create trigger set_sample_requests_updated_at before update on public.sample_requests
  for each row execute function public.set_updated_at();

-- Kept for symmetry with inquiries/inquiry_items (and so a multi-swatch request is
-- expressible later). The UI creates exactly one row per request today.
create table if not exists public.sample_request_items (
  id uuid primary key default gen_random_uuid(),
  sample_request_id uuid not null references public.sample_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sample_request_items_request
  on public.sample_request_items (sample_request_id);
alter table public.sample_request_items enable row level security;
revoke all on public.sample_request_items from anon;

-- Mirrors can_access_inquiry. Needed by sample_request_items and, in the next
-- migration, by the rewritten messages policies.
create or replace function public.can_access_sample_request(request_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sample_requests s
     where s.id = request_uuid
       and (s.buyer_id = auth.uid() or s.supplier_id = auth.uid() or public.is_admin())
  );
$$;

drop policy if exists sample_requests_party_read on public.sample_requests;
create policy sample_requests_party_read on public.sample_requests
  for select to authenticated
  using (buyer_id = auth.uid() or supplier_id = auth.uid() or public.is_admin());

drop policy if exists sample_requests_buyer_insert on public.sample_requests;
create policy sample_requests_buyer_insert on public.sample_requests
  for insert to authenticated
  with check (buyer_id = auth.uid() and public.get_my_role() = 'buyer');

drop policy if exists sample_requests_party_update on public.sample_requests;
create policy sample_requests_party_update on public.sample_requests
  for update to authenticated
  using (buyer_id = auth.uid() or supplier_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or supplier_id = auth.uid() or public.is_admin());

drop policy if exists sample_requests_admin_delete on public.sample_requests;
create policy sample_requests_admin_delete on public.sample_requests
  for delete to authenticated using (public.is_admin());

drop policy if exists sample_request_items_party_read on public.sample_request_items;
create policy sample_request_items_party_read on public.sample_request_items
  for select to authenticated using (public.can_access_sample_request(sample_request_id));

drop policy if exists sample_request_items_buyer_insert on public.sample_request_items;
create policy sample_request_items_buyer_insert on public.sample_request_items
  for insert to authenticated with check (public.can_access_sample_request(sample_request_id));

-- The party UPDATE policy is row-scoped, so without this a buyer could self-mark a
-- request 'delivered' or forge a tracking number, and a supplier could rewrite the
-- buyer's notes. Column-level intent has to live in a trigger.
create or replace function public.guard_sample_request_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then return new; end if;

  if new.buyer_id is distinct from old.buyer_id
     or new.supplier_id is distinct from old.supplier_id then
    raise exception 'not permitted to reassign sample request parties' using errcode = '42501';
  end if;

  if auth.uid() = old.buyer_id then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'buyers may only cancel a sample request' using errcode = '42501';
    end if;
    if new.courier is distinct from old.courier
       or new.tracking_number is distinct from old.tracking_number
       or new.supplier_notes is distinct from old.supplier_notes then
      raise exception 'not permitted to write fulfilment fields' using errcode = '42501';
    end if;
  elsif auth.uid() = old.supplier_id then
    if new.status is distinct from old.status
       and not ((old.status, new.status) in
                (('requested','approved'),('requested','declined'),
                 ('approved','shipped'),('shipped','delivered'))) then
      raise exception 'invalid sample status transition % -> %', old.status, new.status
        using errcode = '42501';
    end if;
    if new.buyer_notes is distinct from old.buyer_notes then
      raise exception 'not permitted to edit buyer notes' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sample_requests_guard on public.sample_requests;
create trigger sample_requests_guard before update on public.sample_requests
  for each row execute function public.guard_sample_request_columns();

revoke execute on function public.guard_sample_request_columns() from public, anon, authenticated;
