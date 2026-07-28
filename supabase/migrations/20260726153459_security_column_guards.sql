-- WS-Sec: close three pre-existing holes found during re-grounding.
--
-- 1. profiles_update_own_or_admin allows UPDATE where id = auth.uid() with no
--    column restriction, and profiles had no BEFORE trigger. Any signed-in user
--    could PATCH themselves to role='admin', status='active', which then satisfies
--    is_admin() in all 60 policies that call it.
-- 2. invoices_supplier_update is row-scoped only, so a supplier could rewrite
--    status / subtotal_pkr / line_items / pdf_url on their own invoices. The
--    payment columns added in WS3 would inherit that hole.
-- 3. The `security_hardening` migration revoked EXECUTE from anon/authenticated,
--    but the ACLs carry =X/postgres, i.e. PUBLIC still held EXECUTE.
--
-- Mechanism mirrors the proven guard_product_admin_columns pattern: Supabase runs
-- every logged-in user as the `authenticated` Postgres role, so column-level GRANTs
-- cannot distinguish admin from supplier. A BEFORE trigger calling is_admin() is the
-- correct tool. service_role stays exempt so edge functions and seed scripts work.

-- ---------------------------------------------------------------- profiles
create or replace function public.guard_profile_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then
    return new;
  end if;

  -- WS6 will extend this list with overdue_flagged / overdue_flagged_at so a
  -- flagged buyer cannot clear their own flag.
  if new.role is distinct from old.role
     or new.status is distinct from old.status then
    raise exception 'not permitted to modify admin-controlled profile columns'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_admin_columns on public.profiles;
create trigger profiles_guard_admin_columns
  before update on public.profiles
  for each row execute function public.guard_profile_admin_columns();

-- ---------------------------------------------------------------- invoices
create or replace function public.guard_invoice_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then
    return new;
  end if;

  -- Parties are fixed at creation.
  if new.buyer_id is distinct from old.buyer_id
     or new.supplier_id is distinct from old.supplier_id
     or new.inquiry_id is distinct from old.inquiry_id then
    raise exception 'not permitted to reassign invoice parties'
      using errcode = '42501';
  end if;

  -- Only forward transitions a supplier legitimately drives. Notably this blocks
  -- un-sending, and blocks 'acknowledged' (a buyer/admin action, not a supplier one).
  -- WS3 extends this to reject payment_status / amount_paid_pkr writes.
  if new.status is distinct from old.status
     and not ((old.status, new.status) in
              (('draft','sent'),('draft','cancelled'),('sent','cancelled'))) then
    raise exception 'invalid invoice status transition % -> %', old.status, new.status
      using errcode = '42501';
  end if;

  -- Once it leaves draft the money is frozen to the supplier.
  if old.status <> 'draft'
     and (new.line_items is distinct from old.line_items
          or new.subtotal_pkr is distinct from old.subtotal_pkr
          or new.subtotal_usd is distinct from old.subtotal_usd) then
    raise exception 'a sent invoice is financially frozen'
      using errcode = '42501';
  end if;

  -- sent_at is stamped by the transition, never written by hand. WS3 (eng-H3)
  -- derives due_date from this same moment.
  if old.status = 'draft' and new.status = 'sent' then
    new.sent_at := now();
  elsif new.sent_at is distinct from old.sent_at then
    raise exception 'not permitted to modify sent_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_guard_admin_columns on public.invoices;
create trigger invoices_guard_admin_columns
  before update on public.invoices
  for each row execute function public.guard_invoice_admin_columns();

-- ---------------------------------------------------------------- revokes
-- ONLY these two. Every other SECURITY DEFINER function in public is referenced
-- by RLS policy expressions (is_admin alone appears in 60 policies across 23
-- tables), and policy expressions are evaluated with the caller's privileges --
-- revoking EXECUTE from PUBLIC on those would break RLS app-wide.
-- These two are trigger-only functions; calling them as RPC raises
-- "trigger functions can only be called as triggers" regardless. Verified that
-- both triggers still fire after the revoke.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.guard_product_admin_columns() from public;

-- NOTE: the two REVOKEs above are INCOMPLETE on their own. Supabase's default
-- privileges also grant EXECUTE explicitly to anon/authenticated/service_role,
-- and an explicit grant survives a PUBLIC revoke. Completed in
-- 20260726160000_revoke_trigger_fn_execute_from_api_roles.sql.
