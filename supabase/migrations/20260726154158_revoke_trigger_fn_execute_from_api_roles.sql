-- Follow-up to 20260726153459. `REVOKE ... FROM PUBLIC` alone is not enough:
-- Supabase's default privileges ALSO grant EXECUTE explicitly to anon,
-- authenticated and service_role, and an explicit grant survives a PUBLIC revoke.
-- (This is the same trap the original `security_hardening` migration fell into,
-- one layer down.) The three guard_* functions are trigger-only -- verified that
-- all three triggers still fire with zero EXECUTE granted to any API role.
revoke execute on function public.guard_product_admin_columns() from public, anon, authenticated;
revoke execute on function public.guard_profile_admin_columns() from public, anon, authenticated;
revoke execute on function public.guard_invoice_admin_columns() from public, anon, authenticated;

-- create_inquiry was left anon-callable by those same default privileges. Not
-- exploitable (an anon caller has auth.uid() = NULL, so the RLS check on
-- inquiries.buyer_id rejects the insert) but it has no business being reachable.
revoke execute on function public.create_inquiry(uuid, jsonb, uuid[]) from public, anon;
