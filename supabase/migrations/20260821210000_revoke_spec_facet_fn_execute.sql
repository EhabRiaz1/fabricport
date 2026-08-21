-- Follow-up to 20260821200000_product_spec_facets, applying the convention established by
-- 20260726154158: a trigger-only function has no business being reachable over the API.
--
-- Supabase's default privileges grant EXECUTE explicitly to anon, authenticated and
-- service_role, so both new functions were exposed at /rest/v1/rpc/ the moment they were
-- created -- flagged by the database linter as
-- anon_security_definer_function_executable.
--
--   refresh_product_spec_facets()  is a trigger function; calling it directly is meaningless.
--   compute_product_spec_facets(uuid) is SECURITY DEFINER and reads product_attributes for
--   whatever id it is handed, which would let an anonymous caller read the specifications of
--   an unpublished or private product by guessing ids. It is only ever called from the
--   trigger and from the backfill, both of which run as the table owner.
--
-- Verified after revoking: inserting a product_attributes row still reprojects spec_facets,
-- so the triggers continue to fire with zero EXECUTE granted to any API role.
revoke execute on function public.refresh_product_spec_facets() from public, anon, authenticated;
revoke execute on function public.compute_product_spec_facets(uuid) from public, anon, authenticated;
