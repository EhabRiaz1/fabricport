-- WS3: manual payment tracking. PKR-ONLY by decision (eng-M2): invoices carry a
-- subtotal_usd for display via the FX rate, but money actually received is
-- recorded in PKR. If USD settlement ever becomes real, add payments.amount_usd
-- plus a currency column rather than overloading amount_pkr.

alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists amount_paid_pkr numeric not null default 0;
alter table public.invoices add column if not exists payment_status text not null default 'unpaid';
alter table public.invoices drop constraint if exists invoices_payment_status_check;
alter table public.invoices add constraint invoices_payment_status_check
  check (payment_status in ('unpaid','partial','paid'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id),
  supplier_id uuid not null references public.suppliers(id),
  amount_pkr numeric not null check (amount_pkr > 0),
  paid_on date not null default current_date,
  method text,
  reference text,
  -- Gateway-ready: all null for the manual pipeline that exists today.
  provider text,
  provider_payment_id text,
  provider_status text,
  raw jsonb,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments (invoice_id);
alter table public.payments enable row level security;
revoke all on public.payments from anon;

-- Parties may READ; only admin may write. Matches "admin runs the pipeline".
drop policy if exists payments_party_read on public.payments;
create policy payments_party_read on public.payments for select to authenticated
  using (buyer_id = auth.uid() or supplier_id = auth.uid() or public.is_admin());

drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_write on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- buyer_id/supplier_id are denormalized for cheap RLS, so they are DERIVED from
-- the invoice rather than trusted from the client -- they cannot drift or be forged.
create or replace function public.set_payment_parties()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select i.buyer_id, i.supplier_id into new.buyer_id, new.supplier_id
  from public.invoices i where i.id = new.invoice_id;
  if new.buyer_id is null then
    raise exception 'invoice % not found', new.invoice_id using errcode = '23503';
  end if;
  new.recorded_by := coalesce(new.recorded_by, auth.uid());
  return new;
end;
$$;
drop trigger if exists payments_set_parties on public.payments;
create trigger payments_set_parties before insert on public.payments
  for each row execute function public.set_payment_parties();

-- eng-C2: fires on INSERT **or UPDATE or DELETE** and FULL-recomputes from the
-- payments rows. Never incremental -- an incremental += would drift permanently
-- the first time a payment is edited or removed.
-- eng-M1: SELECT ... FOR UPDATE serializes concurrent payments on one invoice.
-- eng-H1: SECURITY DEFINER, else this write is evaluated against the invoices
-- policies as the payer and rolls back the admin's insert.
create or replace function public.recalc_invoice_payment_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare iid uuid; v_sub numeric; v_paid numeric;
begin
  -- Handles a payment being moved between invoices: both ends get recomputed.
  foreach iid in array (
    select array_agg(distinct x) from unnest(
      array_remove(array[new.invoice_id, old.invoice_id], null)) x
  ) loop
    select subtotal_pkr into v_sub from public.invoices where id = iid for update;
    select coalesce(sum(amount_pkr), 0) into v_paid
      from public.payments where invoice_id = iid;
    update public.invoices
       set amount_paid_pkr = v_paid,
           payment_status = case
             when v_paid <= 0 then 'unpaid'
             when v_sub is not null and v_paid >= v_sub then 'paid'
             else 'partial' end
     where id = iid;
  end loop;
  return null;
end;
$$;
drop trigger if exists payments_recalc_invoice on public.payments;
create trigger payments_recalc_invoice
  after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_payment_totals();

-- Guard v2. Changes over 20260726153459:
--   * BUG FIX: stamping now runs before the privilege short-circuit. The first
--     version returned early for admins, so an admin-sent invoice would never
--     have received a due_date -- and admins are exactly who sends invoices.
--   * eng-H2: payment_status / amount_paid_pkr / due_date are admin-only, so a
--     supplier cannot self-mark an invoice paid now that the columns exist.
--   * eng-H3: due_date = sent_at + 30 days, stamped on send. Overdue is then
--     status in ('sent','acknowledged') and payment_status <> 'paid' and
--     due_date < now() -- drafts can never count, because a draft has no due_date.
--   * eng-M2: an invoice cannot enter the payment flow without a subtotal.
create or replace function public.guard_invoice_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_priv    boolean := (auth.role() = 'service_role') or public.is_admin();
  v_sending boolean := (old.status = 'draft' and new.status = 'sent');
begin
  if v_sending then
    if new.subtotal_pkr is null then
      raise exception 'an invoice needs a subtotal before it can be sent'
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

  if not v_sending and new.due_date is distinct from old.due_date then
    raise exception 'not permitted to modify due_date' using errcode = '42501';
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
          or new.subtotal_usd is distinct from old.subtotal_usd) then
    raise exception 'a sent invoice is financially frozen' using errcode = '42501';
  end if;

  if not v_sending and new.sent_at is distinct from old.sent_at then
    raise exception 'not permitted to modify sent_at' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.set_payment_parties()           from public, anon, authenticated;
revoke execute on function public.recalc_invoice_payment_totals() from public, anon, authenticated;
