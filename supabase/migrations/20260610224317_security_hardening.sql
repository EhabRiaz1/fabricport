-- RECOVERED from supabase_migrations.schema_migrations on 2026-07-26.
-- This migration was applied to production but had no file on disk, so a
-- `supabase db reset` would have silently dropped it. Recovered verbatim.
--
-- NOTE: the two REVOKE statements below do NOT achieve their stated goal.
-- Both functions' ACLs carry `=X/postgres`, i.e. PUBLIC holds EXECUTE, so
-- revoking from anon/authenticated changes nothing. Superseded for
-- handle_new_user by 20260726120000_security_column_guards.sql, which revokes
-- from PUBLIC. get_supplier_visitor_stats is deliberately left executable: it
-- self-authorizes internally via (supplier_uuid = auth.uid() OR is_admin()).

-- Pin search_path on the trigger helper flagged by the linter
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- handle_new_user is only invoked by the auth trigger; no API role needs it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Visitor stats are for signed-in suppliers/admins only
REVOKE EXECUTE ON FUNCTION public.get_supplier_visitor_stats(uuid, timestamptz) FROM anon;
