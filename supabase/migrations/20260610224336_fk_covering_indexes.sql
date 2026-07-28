-- RECOVERED from supabase_migrations.schema_migrations on 2026-07-26.
-- Applied to production but had no file on disk; a `supabase db reset` would
-- have silently dropped these six indexes. Recovered verbatim.

CREATE INDEX IF NOT EXISTS idx_product_private_domains_created_by ON public.product_private_domains (created_by);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products (created_by);
CREATE INDEX IF NOT EXISTS idx_products_price_approved_by ON public.products (price_approved_by);
CREATE INDEX IF NOT EXISTS idx_recent_views_product_id ON public.recent_views (product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_page_views_viewer_id ON public.supplier_page_views (viewer_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON public.support_messages (sender_id);
