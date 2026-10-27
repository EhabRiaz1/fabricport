-- Fix-list items 31-34 (supplier portal) and the shared app_settings table.
--
--   1. app_settings: key/value store read by every client, written by admins.
--      Seeds the invoice defaults (tax rate, tax mode, freight, payment terms).
--   2. invoices: tax, freight, payment terms and a grand total. Totals are
--      computed server-side from line_items on every draft write, so the
--      stored subtotal/tax/total can never disagree with the lines.
--   3. Payment status compares amount paid against total_pkr, not subtotal.
--   4. Guard v3: suppliers may set due_date / terms / tax / freight on a DRAFT;
--      all of it freezes once sent. Unit prices must be > 0 and quantities > 0.
--   5. products: CHECK constraints for stock, MOQ and prices (fix #34).
--   6. get_catalogue: also returns the supplier id so a share-link visitor can
--      inquire or request a sample; create_catalogue_inquiry lets a signed-in
--      buyer inquire about a private product they can only see via the link.

-- ---------------------------------------------------------------- 1. app_settings
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to anon, authenticated using (true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings
  for insert to authenticated with check (public.is_admin());

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('invoice_defaults',
   '{"tax_rate_percent": 18, "tax_mode": "total", "freight_pkr": 0, "payment_terms": "Net 30"}'::jsonb),
  ('invoice_payment_terms_options',
   '["Advance", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Against delivery"]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- 2. invoice columns
alter table public.invoices add column if not exists tax_rate_percent numeric not null default 0;
alter table public.invoices add column if not exists tax_mode text not null default 'total';
alter table public.invoices add column if not exists tax_pkr numeric not null default 0;
alter table public.invoices add column if not exists freight_pkr numeric not null default 0;
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists total_pkr numeric;

alter table public.invoices drop constraint if exists invoices_tax_mode_check;
alter table public.invoices add constraint invoices_tax_mode_check
  check (tax_mode in ('total', 'per_line'));
alter table public.invoices drop constraint if exists invoices_tax_rate_check;
alter table public.invoices add constraint invoices_tax_rate_check
  check (tax_rate_percent >= 0 and tax_rate_percent <= 100);
alter table public.invoices drop constraint if exists invoices_freight_check;
alter table public.invoices add constraint invoices_freight_check
  check (freight_pkr >= 0);

-- Existing invoices had no tax or freight: total is the subtotal.
update public.invoices set total_pkr = subtotal_pkr where total_pkr is null;

-- Totals are derived from the lines. Runs on INSERT and on any draft UPDATE;
-- after send the guard below rejects financial changes, so the stored numbers
-- are the ones the buyer was sent.
create or replace function public.compute_invoice_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sub_pkr numeric := 0;
  v_sub_usd numeric := 0;
  v_tax     numeric := 0;
  v_line    jsonb;
  v_qty     numeric;
  v_unit    numeric;
  v_unit_usd numeric;
  v_rate    numeric;
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    return new;   -- frozen; the guard trigger raises if anything financial moved
  end if;
  -- Cancelling a draft must always work, even for a legacy draft whose lines
  -- would fail the checks below (e.g. a zero unit price).
  if tg_op = 'UPDATE' and new.status = 'cancelled' then
    return new;
  end if;

  if new.line_items is null or jsonb_typeof(new.line_items) <> 'array'
     or jsonb_array_length(new.line_items) = 0 then
    raise exception 'an invoice needs at least one line item' using errcode = '22023';
  end if;

  new.tax_rate_percent := coalesce(new.tax_rate_percent, 0);
  new.freight_pkr      := coalesce(new.freight_pkr, 0);
  new.tax_mode         := coalesce(new.tax_mode, 'total');

  for v_line in select * from jsonb_array_elements(new.line_items) loop
    v_qty      := (v_line ->> 'qty')::numeric;
    v_unit     := (v_line ->> 'unit_price_pkr')::numeric;
    v_unit_usd := coalesce((v_line ->> 'unit_price_usd')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'line quantity must be greater than zero' using errcode = '22023';
    end if;
    if v_unit is null or v_unit <= 0 then
      raise exception 'line unit price must be greater than zero' using errcode = '22023';
    end if;
    v_sub_pkr := v_sub_pkr + v_qty * v_unit;
    v_sub_usd := v_sub_usd + v_qty * v_unit_usd;
    if new.tax_mode = 'per_line' then
      v_rate := coalesce((v_line ->> 'tax_rate_percent')::numeric, new.tax_rate_percent);
      if v_rate < 0 or v_rate > 100 then
        raise exception 'line tax rate must be between 0 and 100' using errcode = '22023';
      end if;
      v_tax := v_tax + (v_qty * v_unit) * v_rate / 100;
    end if;
  end loop;

  if new.tax_mode = 'total' then
    v_tax := v_sub_pkr * new.tax_rate_percent / 100;
  end if;

  new.subtotal_pkr := round(v_sub_pkr, 2);
  new.subtotal_usd := round(v_sub_usd, 2);
  new.tax_pkr      := round(v_tax, 2);
  new.total_pkr    := round(v_sub_pkr + v_tax + new.freight_pkr, 2);
  return new;
end;
$$;
revoke execute on function public.compute_invoice_totals() from public, anon, authenticated;

-- Must fire BEFORE the guard so a send sees a complete total. Trigger names
-- fire alphabetically: "invoices_a_compute_totals" < "invoices_guard_*".
drop trigger if exists invoices_a_compute_totals on public.invoices;
create trigger invoices_a_compute_totals
  before insert or update on public.invoices
  for each row execute function public.compute_invoice_totals();

-- ---------------------------------------------------------------- 3. payment status vs total
create or replace function public.recalc_invoice_payment_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare iid uuid; v_total numeric; v_paid numeric;
begin
  foreach iid in array (
    select array_agg(distinct x) from unnest(
      array_remove(array[new.invoice_id, old.invoice_id], null)) x
  ) loop
    select coalesce(total_pkr, subtotal_pkr) into v_total
      from public.invoices where id = iid for update;
    select coalesce(sum(amount_pkr), 0) into v_paid
      from public.payments where invoice_id = iid;
    update public.invoices
       set amount_paid_pkr = v_paid,
           payment_status = case
             when v_paid <= 0 then 'unpaid'
             when v_total is not null and v_paid >= v_total then 'paid'
             else 'partial' end
     where id = iid;
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------- 4. guard v3
create or replace function public.guard_invoice_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_priv    boolean := (auth.role() = 'service_role') or public.is_admin();
  v_sending boolean := (old.status = 'draft' and new.status = 'sent');
begin
  if v_sending then
    if new.total_pkr is null then
      raise exception 'an invoice needs a total before it can be sent'
        using errcode = '22023';
    end if;
    new.sent_at  := now();
    new.due_date := coalesce(new.due_date, (now() + interval '30 days')::date);
  end if;

  if v_priv then return new; end if;

  if new.buyer_id is distinct from old.buyer_id
     or new.supplier_id is distinct from old.supplier_id
     or new.inquiry_id is distinct from old.inquiry_id then
    raise exception 'not permitted to reassign invoice parties' using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.amount_paid_pkr is distinct from old.amount_paid_pkr then
    raise exception 'payment fields are admin-controlled' using errcode = '42501';
  end if;

  -- Suppliers set the due date while drafting (or leave it for the +30 default
  -- stamped on send). Once sent it is frozen.
  if old.status <> 'draft' and new.due_date is distinct from old.due_date then
    raise exception 'not permitted to modify due_date on a sent invoice' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not ((old.status, new.status) in
              (('draft','sent'),('draft','cancelled'),('sent','cancelled'))) then
    raise exception 'invalid invoice status transition % -> %', old.status, new.status
      using errcode = '42501';
  end if;

  if old.status <> 'draft'
     and (new.line_items is distinct from old.line_items
          or new.subtotal_pkr is distinct from old.subtotal_pkr
          or new.subtotal_usd is distinct from old.subtotal_usd
          or new.tax_rate_percent is distinct from old.tax_rate_percent
          or new.tax_mode is distinct from old.tax_mode
          or new.tax_pkr is distinct from old.tax_pkr
          or new.freight_pkr is distinct from old.freight_pkr
          or new.total_pkr is distinct from old.total_pkr
          or new.payment_terms is distinct from old.payment_terms
          or new.notes is distinct from old.notes) then
    raise exception 'a sent invoice is financially frozen' using errcode = '42501';
  end if;

  if not v_sending and new.sent_at is distinct from old.sent_at then
    raise exception 'not permitted to modify sent_at' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------- 5. product checks
alter table public.products drop constraint if exists products_stock_nonneg;
alter table public.products add constraint products_stock_nonneg
  check (stock_meters >= 0) not valid;
alter table public.products drop constraint if exists products_moq_nonneg;
alter table public.products add constraint products_moq_nonneg
  check (moq_meters is null or moq_meters >= 0) not valid;
alter table public.products drop constraint if exists products_price_nonneg;
alter table public.products add constraint products_price_nonneg
  check ((price_min_pkr is null or price_min_pkr >= 0)
     and (price_max_pkr is null or price_max_pkr >= 0)) not valid;
alter table public.products drop constraint if exists products_price_range;
alter table public.products add constraint products_price_range
  check (price_min_pkr is null or price_max_pkr is null or price_max_pkr >= price_min_pkr) not valid;

do $$
declare c text;
begin
  foreach c in array array['products_stock_nonneg','products_moq_nonneg',
                           'products_price_nonneg','products_price_range'] loop
    begin
      execute format('alter table public.products validate constraint %I', c);
    exception when check_violation then
      raise notice 'constraint % left NOT VALID: existing rows violate it', c;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------- 6. catalogue inquiries
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
      'id', s.id, 'brand_name', s.brand_name, 'slug', s.slug, 'is_verified', s.is_verified
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'slug', p.slug, 'images', p.images,
        'visibility', p.visibility,
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

-- A share link is the buyer's proof of access to a private fabric, which
-- can_view_product (used by create_inquiry) knows nothing about. This RPC
-- re-checks the token server-side and creates the inquiry as the caller.
create or replace function public.create_catalogue_inquiry(
  p_token text,
  p_product_id uuid,
  p_quantity_meters numeric,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier uuid;
  v_title text;
  v_inquiry uuid;
  v_message text;
begin
  if auth.uid() is null then
    raise exception 'sign in to inquire' using errcode = '42501';
  end if;
  if not exists (select 1 from public.buyers b where b.id = auth.uid()) then
    raise exception 'only buyer accounts can inquire' using errcode = '42501';
  end if;
  if p_quantity_meters is null or p_quantity_meters <= 0 or p_quantity_meters > 10000000
     or p_quantity_meters <> round(p_quantity_meters) then
    raise exception 'quantity must be a whole number of metres between 1 and 10,000,000'
      using errcode = '22023';
  end if;

  select c.supplier_id, p.title into v_supplier, v_title
  from public.catalogues c
  join public.catalogue_products cp on cp.catalogue_id = c.id
  join public.products p on p.id = cp.product_id
  where c.share_token = p_token
    and c.is_active
    and (c.expires_at is null or c.expires_at > now())
    and p.id = p_product_id
    and p.status = 'published';
  if v_supplier is null then
    raise exception 'this fabric is not available through that link' using errcode = '42501';
  end if;

  insert into public.inquiries (buyer_id, supplier_id, status)
  values (auth.uid(), v_supplier, 'open')
  returning id into v_inquiry;

  insert into public.inquiry_items (inquiry_id, product_id, quantity_meters)
  values (v_inquiry, p_product_id, p_quantity_meters);

  v_message := nullif(btrim(coalesce(p_message, '')), '');
  if v_message is null then
    v_message := 'Hi, I would like to inquire about:' || E'\n• ' || v_title || ' — '
      || to_char(p_quantity_meters, 'FM999,999,999') || ' m (via your shared catalogue)';
  end if;
  insert into public.messages (inquiry_id, sender_id, content)
  values (v_inquiry, auth.uid(), v_message);

  return v_inquiry;
end;
$$;
revoke execute on function public.create_catalogue_inquiry(text, uuid, numeric, text) from public, anon;
grant  execute on function public.create_catalogue_inquiry(text, uuid, numeric, text) to authenticated;
