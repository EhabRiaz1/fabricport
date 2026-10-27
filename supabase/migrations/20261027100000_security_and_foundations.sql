-- Fix-list foundations (Oct 2026). Security closes first, then the small schema
-- additions that several later changes depend on.
--
--   1. handle_new_user: the sign-up trigger took `role` straight from the client
--      metadata and accepted 'admin' with status 'active'. Anyone holding the anon
--      key could sign up as an active admin. Only buyer/supplier are accepted now.
--      It also stores phone / WhatsApp from sign-up metadata (fix #5), using the
--      same [{label, number}] shape the settings pages write.
--   2. profiles.is_demo: admin-set flag. Demo / test accounts are excluded from
--      counts, reports and analytics (fix #45, replaces the staging ask in #48).
--   3. invoices: the guard trigger only ran BEFORE UPDATE, so a supplier could
--      INSERT an invoice already 'sent' / 'paid'. Non-privileged inserts are now
--      forced into the draft shape.
--   4. get_catalogue: returned draft products and unapproved prices to anyone
--      holding a share link. Now published-only, prices only when approved.
--   5. create_inquiry: takes p_message and posts it as the opening chat message
--      in the same transaction (fix #21).
--   6. messages: first supplier message on an open inquiry sets it to
--      'responded' (fix #22).

-- ---------------------------------------------------------------- 1. sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role    text;
  email_domain text;
  v_phone      text;
  v_whatsapp   text;
begin
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');

  -- Admin accounts are created only through the admin-users function.
  if user_role not in ('supplier', 'buyer') then
    user_role := 'buyer';
  end if;

  v_phone    := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_whatsapp := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'whatsapp', '')), '');

  insert into public.profiles (
    id, role, full_name, company_name, status, phone_numbers, whatsapp_numbers
  )
  values (
    new.id,
    user_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company_name',
    case when user_role = 'supplier' then 'pending' else 'active' end,
    case when v_phone is null then '[]'::jsonb
         else jsonb_build_array(jsonb_build_object('label', 'primary', 'number', v_phone)) end,
    case when v_whatsapp is null then '[]'::jsonb
         else jsonb_build_array(jsonb_build_object('label', 'primary', 'number', v_whatsapp)) end
  );

  if user_role = 'buyer' then
    email_domain := split_part(new.email, '@', 2);
    insert into public.buyers (id, email_domain)
    values (new.id, nullif(email_domain, ''));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- 2. demo flag
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Admin-set. Demo/test accounts: excluded from reports, dashboard counts, '
  'supplier analytics and visitor stats.';

create index if not exists idx_profiles_is_demo on public.profiles (is_demo) where is_demo;

-- Only admins may flip it. profiles update policies are row-scoped, so guard the column.
create or replace function public.guard_profile_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then
    return new;
  end if;
  if new.is_demo is distinct from old.is_demo then
    raise exception 'is_demo is admin-controlled' using errcode = '42501';
  end if;
  if new.role is distinct from old.role or new.status is distinct from old.status then
    raise exception 'role and status are admin-controlled' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_admin_columns() from public, anon, authenticated;

drop trigger if exists profiles_guard_admin_columns on public.profiles;
create trigger profiles_guard_admin_columns
  before update on public.profiles
  for each row execute function public.guard_profile_admin_columns();

-- ---------------------------------------------------------------- 3. invoice insert
create or replace function public.guard_invoice_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then
    return new;
  end if;
  -- A supplier can only ever create a draft. Everything financial about the
  -- payment side is admin-controlled and starts at zero.
  new.status          := 'draft';
  new.payment_status  := 'unpaid';
  new.amount_paid_pkr := 0;
  new.sent_at         := null;
  return new;
end;
$$;
revoke execute on function public.guard_invoice_insert() from public, anon, authenticated;

drop trigger if exists invoices_guard_insert on public.invoices;
create trigger invoices_guard_insert
  before insert on public.invoices
  for each row execute function public.guard_invoice_insert();

-- ---------------------------------------------------------------- 4. catalogue
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
        'spec_facets', p.spec_facets,
        'sample_available', p.sample_available,
        'price_approved', p.price_approved,
        'price_min_pkr', case when p.price_approved then p.price_min_pkr end,
        'price_max_pkr', case when p.price_approved then p.price_max_pkr end,
        'price_min_usd', case when p.price_approved then p.price_min_usd end,
        'price_max_usd', case when p.price_approved then p.price_max_usd end,
        'stock_meters', p.stock_meters, 'moq_meters', p.moq_meters,
        'lead_time_days', p.lead_time_days, 'color_hex', p.color_hex,
        'description', p.description,
        'attributes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'value_text', pa.value_text, 'value_number', pa.value_number,
            'attribute', jsonb_build_object('slug', fa.slug, 'name', fa.name, 'unit', fa.unit)
          ))
          from public.product_attributes pa
          join public.fabric_attributes fa on fa.id = pa.attribute_id
          where pa.product_id = p.id
        ), '[]'::jsonb)
      ) order by p.title)
      from public.catalogue_products cp
      join public.products p on p.id = cp.product_id
      where cp.catalogue_id = c.id
        and p.status = 'published'
    ), '[]'::jsonb)
  )
  from public.catalogues c
  join public.suppliers s on s.id = c.supplier_id
  where c.share_token = p_token
    and c.is_active
    and (c.expires_at is null or c.expires_at > now());
$$;

grant execute on function public.get_catalogue(text) to anon, authenticated;

-- ---------------------------------------------------------------- 5. inquiry opener
drop function if exists public.create_inquiry(uuid, jsonb, uuid[]);

create or replace function public.create_inquiry(
  p_supplier_id uuid,
  p_lines jsonb,
  p_cart_item_ids uuid[] default null,
  p_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inquiry_id uuid;
  v_valid int;
  v_bad int;
  v_message text;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'an inquiry needs at least one line' using errcode = '22023';
  end if;

  select count(*) into v_valid
  from jsonb_to_recordset(p_lines)
       as l(product_id uuid, quantity_meters numeric, notes text)
  join public.products p on p.id = l.product_id
  where p.supplier_id = p_supplier_id
    and public.can_view_product(p.id);

  if v_valid <> jsonb_array_length(p_lines) then
    raise exception 'inquiry lines must reference visible products belonging to supplier %',
      p_supplier_id using errcode = '42501';
  end if;

  -- Fix #7: quantities are validated here as well as in the UI.
  select count(*) into v_bad
  from jsonb_to_recordset(p_lines)
       as l(product_id uuid, quantity_meters numeric, notes text)
  where l.quantity_meters is null
     or l.quantity_meters <= 0
     or l.quantity_meters > 10000000
     or l.quantity_meters <> round(l.quantity_meters);
  if v_bad > 0 then
    raise exception 'quantity must be a whole number of metres between 1 and 10,000,000'
      using errcode = '22023';
  end if;

  insert into public.inquiries (buyer_id, supplier_id, status)
  values (auth.uid(), p_supplier_id, 'open')
  returning id into v_inquiry_id;

  insert into public.inquiry_items (inquiry_id, product_id, quantity_meters, notes)
  select v_inquiry_id, l.product_id, l.quantity_meters, l.notes
  from jsonb_to_recordset(p_lines)
       as l(product_id uuid, quantity_meters numeric, notes text);

  -- Opening message so the supplier never sees an empty chat. If the caller
  -- supplied text, use it; otherwise build one from the lines.
  v_message := nullif(btrim(coalesce(p_message, '')), '');
  if v_message is null then
    select 'Hi, I would like to inquire about:' || E'\n' ||
           string_agg(
             '• ' || p.title || ' — ' || to_char(l.quantity_meters, 'FM999,999,999') || ' m'
             || coalesce(E'\n  ' || nullif(btrim(l.notes), ''), ''),
             E'\n' order by p.title)
      into v_message
    from jsonb_to_recordset(p_lines)
         as l(product_id uuid, quantity_meters numeric, notes text)
    join public.products p on p.id = l.product_id;
  end if;

  insert into public.messages (inquiry_id, sender_id, content)
  values (v_inquiry_id, auth.uid(), v_message);

  if p_cart_item_ids is not null then
    delete from public.cart_items
     where id = any(p_cart_item_ids) and buyer_id = auth.uid();
  end if;

  return v_inquiry_id;
end;
$$;

revoke execute on function public.create_inquiry(uuid, jsonb, uuid[], text) from public, anon;
grant  execute on function public.create_inquiry(uuid, jsonb, uuid[], text) to authenticated;

-- Quantity sanity at the table level too (cart + inquiry lines).
alter table public.cart_items    drop constraint if exists cart_items_quantity_check;
alter table public.cart_items    add  constraint cart_items_quantity_check
  check (quantity_meters > 0 and quantity_meters <= 10000000);
alter table public.inquiry_items drop constraint if exists inquiry_items_quantity_check;
alter table public.inquiry_items add  constraint inquiry_items_quantity_check
  check (quantity_meters > 0 and quantity_meters <= 10000000);

-- ---------------------------------------------------------------- 6. responded
create or replace function public.mark_inquiry_responded()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.inquiry_id is null then
    return new;
  end if;
  update public.inquiries i
     set status = 'responded'
   where i.id = new.inquiry_id
     and i.status = 'open'
     and i.supplier_id = new.sender_id;
  return new;
end;
$$;
revoke execute on function public.mark_inquiry_responded() from public, anon, authenticated;

drop trigger if exists messages_mark_inquiry_responded on public.messages;
create trigger messages_mark_inquiry_responded
  after insert on public.messages
  for each row execute function public.mark_inquiry_responded();

-- Backfill: inquiries still 'open' where the supplier has already replied.
update public.inquiries i
   set status = 'responded'
 where i.status = 'open'
   and exists (
     select 1 from public.messages m
     where m.inquiry_id = i.id and m.sender_id = i.supplier_id
   );
