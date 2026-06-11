-- FabricPort Initial Schema
-- Version 1.0 | Production-ready migration for Supabase
-- Apply via: supabase db push | MCP apply_migration

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- 1. color_families
CREATE TABLE public.color_families (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. profiles
CREATE TABLE public.profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('admin', 'supplier', 'buyer')),
  full_name        text,
  company_name     text,
  avatar_url       text,
  phone_numbers    jsonb NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. suppliers
CREATE TABLE public.suppliers (
  id                    uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  brand_name            text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  website_url           text,
  instagram_url         text,
  is_verified           boolean NOT NULL DEFAULT false,
  badge_label           text,
  notification_settings jsonb NOT NULL DEFAULT '{
    "inquiry_received": {"email": true, "whatsapp": true, "in_app": true},
    "message_received": {"email": true, "whatsapp": false, "in_app": true}
  }'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 4. buyers
CREATE TABLE public.buyers (
  id           uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_domain text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 5. fabric_categories
CREATE TABLE public.fabric_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  parent_id  uuid REFERENCES public.fabric_categories (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. fabric_attributes
CREATE TABLE public.fabric_attributes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid REFERENCES public.fabric_categories (id) ON DELETE CASCADE,
  name           text NOT NULL,
  slug           text NOT NULL,
  type           text NOT NULL CHECK (type IN ('text', 'number', 'select', 'multiselect', 'boolean', 'range')),
  unit           text,
  options        jsonb,
  is_required    boolean NOT NULL DEFAULT false,
  is_filterable  boolean NOT NULL DEFAULT true,
  display_order  int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 7. products
CREATE TABLE public.products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  category_id         uuid REFERENCES public.fabric_categories (id) ON DELETE SET NULL,
  title               text NOT NULL,
  slug                text UNIQUE NOT NULL,
  description         text,
  status              text NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'pending_listing_request',
      'fabric_received',
      'scanning',
      'ready_to_publish',
      'published',
      'archived'
    )
  ),
  visibility          text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  price_min_pkr       numeric,
  price_max_pkr       numeric,
  price_min_usd       numeric,
  price_max_usd       numeric,
  price_approved      boolean NOT NULL DEFAULT false,
  price_approved_by   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  price_approved_at   timestamptz,
  stock_meters        numeric NOT NULL DEFAULT 0,
  moq_meters          numeric,
  lead_time_days      int,
  images              jsonb NOT NULL DEFAULT '[]'::jsonb,
  scan_files          jsonb NOT NULL DEFAULT '[]'::jsonb,
  color_supplier_name text,
  color_display_name  text,
  color_hex           text,
  color_rgb           jsonb,
  color_family        text REFERENCES public.color_families (slug) ON DELETE SET NULL,
  color_sample        jsonb,
  is_featured         boolean NOT NULL DEFAULT false,
  view_count          int NOT NULL DEFAULT 0,
  inquiry_count       int NOT NULL DEFAULT 0,
  created_by          uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  published_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 8. product_attributes (EAV)
CREATE TABLE public.product_attributes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.fabric_attributes (id) ON DELETE CASCADE,
  value_text   text,
  value_number numeric,
  value_json   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, attribute_id)
);

-- 9. product_private_domains
CREATE TABLE public.product_private_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  domain     text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, domain)
);

-- 10. listing_requests
CREATE TABLE public.listing_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  product_id       uuid REFERENCES public.products (id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'fabric_received', 'scanning', 'complete', 'rejected')
  ),
  supplier_notes   text,
  fabric_details   jsonb,
  admin_notes      text,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 11. inquiries
CREATE TABLE public.inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    uuid NOT NULL REFERENCES public.buyers (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'responded', 'negotiating', 'closed', 'archived')
  ),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 12. inquiry_items
CREATE TABLE public.inquiry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id      uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity_meters numeric,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 13. messages (realtime enabled)
CREATE TABLE public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  content     text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 14. cart_items
CREATE TABLE public.cart_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        uuid NOT NULL REFERENCES public.buyers (id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  quantity_meters numeric NOT NULL DEFAULT 1,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, product_id)
);

-- 15. invoices
CREATE TABLE public.invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id   uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  supplier_id  uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  buyer_id     uuid NOT NULL REFERENCES public.buyers (id) ON DELETE CASCADE,
  line_items   jsonb NOT NULL,
  subtotal_pkr numeric,
  subtotal_usd numeric,
  notes        text,
  status       text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'acknowledged', 'cancelled')
  ),
  pdf_url      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

-- 16. notifications (realtime enabled)
CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 17. recent_views
CREATE TABLE public.recent_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id text,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now()
);

-- 18. page_presence
CREATE TABLE public.page_presence (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id text,
  page_path  text NOT NULL,
  user_agent text,
  last_seen  timestamptz NOT NULL DEFAULT now()
);

-- 19. supplier_page_views
CREATE TABLE public.supplier_page_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products (id) ON DELETE SET NULL,
  viewer_id   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  session_id  text,
  referrer    text,
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

-- 20. whatsapp_log
CREATE TABLE public.whatsapp_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  phone_number  text NOT NULL,
  template      text NOT NULL,
  variables     jsonb,
  status        text CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  wa_message_id text,
  sent_at       timestamptz NOT NULL DEFAULT now()
);

-- 21. fx_rates
CREATE TABLE public.fx_rates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base       text NOT NULL DEFAULT 'USD',
  target     text NOT NULL DEFAULT 'PKR',
  rate       numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_status ON public.profiles (status);

CREATE INDEX idx_suppliers_slug ON public.suppliers (slug);
CREATE INDEX idx_suppliers_is_verified ON public.suppliers (is_verified) WHERE is_verified = true;

CREATE INDEX idx_buyers_email_domain ON public.buyers (email_domain);

CREATE INDEX idx_fabric_categories_parent_id ON public.fabric_categories (parent_id);
CREATE INDEX idx_fabric_categories_slug ON public.fabric_categories (slug);

CREATE UNIQUE INDEX fabric_attributes_global_slug_unique
  ON public.fabric_attributes (slug)
  WHERE category_id IS NULL;

CREATE UNIQUE INDEX fabric_attributes_category_slug_unique
  ON public.fabric_attributes (category_id, slug)
  WHERE category_id IS NOT NULL;

CREATE INDEX idx_fabric_attributes_category_id ON public.fabric_attributes (category_id);
CREATE INDEX idx_fabric_attributes_filterable ON public.fabric_attributes (is_filterable) WHERE is_filterable = true;

CREATE INDEX idx_products_supplier_id ON public.products (supplier_id);
CREATE INDEX idx_products_category_id ON public.products (category_id);
CREATE INDEX idx_products_slug ON public.products (slug);
CREATE INDEX idx_products_status ON public.products (status);
CREATE INDEX idx_products_visibility ON public.products (visibility);
CREATE INDEX idx_products_published ON public.products (published_at DESC) WHERE status = 'published';
CREATE INDEX idx_products_featured ON public.products (is_featured) WHERE is_featured = true AND status = 'published';
CREATE INDEX idx_products_color_family ON public.products (color_family) WHERE status = 'published';

CREATE INDEX idx_product_attributes_product_id ON public.product_attributes (product_id);
CREATE INDEX idx_product_attributes_attribute_id ON public.product_attributes (attribute_id);

CREATE INDEX idx_product_private_domains_product_id ON public.product_private_domains (product_id);
CREATE INDEX idx_product_private_domains_domain ON public.product_private_domains (domain);

CREATE INDEX idx_listing_requests_supplier_id ON public.listing_requests (supplier_id);
CREATE INDEX idx_listing_requests_status ON public.listing_requests (status);
CREATE INDEX idx_listing_requests_product_id ON public.listing_requests (product_id);

CREATE INDEX idx_inquiries_buyer_id ON public.inquiries (buyer_id);
CREATE INDEX idx_inquiries_supplier_id ON public.inquiries (supplier_id);
CREATE INDEX idx_inquiries_status ON public.inquiries (status);
CREATE INDEX idx_inquiries_created_at ON public.inquiries (created_at DESC);

CREATE INDEX idx_inquiry_items_inquiry_id ON public.inquiry_items (inquiry_id);
CREATE INDEX idx_inquiry_items_product_id ON public.inquiry_items (product_id);

CREATE INDEX idx_messages_inquiry_id ON public.messages (inquiry_id);
CREATE INDEX idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX idx_messages_created_at ON public.messages (created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages (inquiry_id) WHERE read_at IS NULL;

CREATE INDEX idx_cart_items_buyer_id ON public.cart_items (buyer_id);
CREATE INDEX idx_cart_items_product_id ON public.cart_items (product_id);

CREATE INDEX idx_invoices_inquiry_id ON public.invoices (inquiry_id);
CREATE INDEX idx_invoices_supplier_id ON public.invoices (supplier_id);
CREATE INDEX idx_invoices_buyer_id ON public.invoices (buyer_id);
CREATE INDEX idx_invoices_status ON public.invoices (status);

CREATE INDEX idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);

CREATE UNIQUE INDEX recent_views_user_product_unique
  ON public.recent_views (user_id, product_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX recent_views_session_product_unique
  ON public.recent_views (session_id, product_id)
  WHERE user_id IS NULL AND session_id IS NOT NULL;

CREATE INDEX idx_recent_views_user_id ON public.recent_views (user_id);
CREATE INDEX idx_recent_views_viewed_at ON public.recent_views (viewed_at DESC);

CREATE UNIQUE INDEX page_presence_user_unique
  ON public.page_presence (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX page_presence_session_unique
  ON public.page_presence (session_id)
  WHERE user_id IS NULL AND session_id IS NOT NULL;

CREATE INDEX idx_page_presence_last_seen ON public.page_presence (last_seen DESC);

CREATE INDEX idx_supplier_page_views_supplier_id ON public.supplier_page_views (supplier_id);
CREATE INDEX idx_supplier_page_views_product_id ON public.supplier_page_views (product_id);
CREATE INDEX idx_supplier_page_views_viewed_at ON public.supplier_page_views (viewed_at DESC);

CREATE INDEX idx_whatsapp_log_user_id ON public.whatsapp_log (user_id);
CREATE INDEX idx_whatsapp_log_sent_at ON public.whatsapp_log (sent_at DESC);

CREATE INDEX idx_fx_rates_fetched_at ON public.fx_rates (fetched_at DESC);
CREATE UNIQUE INDEX fx_rates_base_target_unique ON public.fx_rates (base, target);

-- =============================================================================
-- HELPER FUNCTIONS (after tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_buyer_domain()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT b.email_domain FROM public.buyers b WHERE b.id = auth.uid()),
    NULLIF(split_part(auth.jwt() ->> 'email', '@', 2), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supplier_owner(supplier_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.id = supplier_uuid
      AND s.id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_inquiry(inquiry_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.inquiries i
    WHERE i.id = inquiry_uuid
      AND (
        i.buyer_id = auth.uid()
        OR i.supplier_id = auth.uid()
        OR public.is_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_product(product_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_uuid
      AND (
        public.is_admin()
        OR public.is_supplier_owner(p.supplier_id)
        OR (
          p.status = 'published'
          AND (
            p.visibility = 'public'
            OR (
              auth.uid() IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.product_private_domains ppd
                WHERE ppd.product_id = p.id
                  AND ppd.domain = public.get_buyer_domain()
              )
            )
          )
        )
      )
  );
$$;

-- =============================================================================
-- TRIGGERS: updated_at
-- =============================================================================

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_fabric_categories_updated_at
  BEFORE UPDATE ON public.fabric_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_fabric_attributes_updated_at
  BEFORE UPDATE ON public.fabric_attributes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_product_attributes_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_listing_requests_updated_at
  BEFORE UPDATE ON public.listing_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- AUTH: handle_new_user trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  email_domain text;
BEGIN
  user_role := COALESCE(new.raw_user_meta_data ->> 'role', 'buyer');

  IF user_role NOT IN ('admin', 'supplier', 'buyer') THEN
    user_role := 'buyer';
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    company_name,
    status
  )
  VALUES (
    new.id,
    user_role,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'company_name',
    CASE
      WHEN user_role = 'supplier' THEN 'pending'
      WHEN user_role = 'admin' THEN 'active'
      ELSE 'active'
    END
  );

  IF user_role = 'buyer' THEN
    email_domain := split_part(new.email, '@', 2);
    INSERT INTO public.buyers (id, email_domain)
    VALUES (new.id, NULLIF(email_domain, ''));
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.color_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_private_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- color_families: public read, admin write
CREATE POLICY "color_families_public_read"
  ON public.color_families FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "color_families_admin_insert"
  ON public.color_families FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "color_families_admin_update"
  ON public.color_families FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "color_families_admin_delete"
  ON public.color_families FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- profiles: own read/update; admin all
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- suppliers: public read verified; own read/write; admin all
CREATE POLICY "suppliers_public_read_verified"
  ON public.suppliers FOR SELECT
  TO anon, authenticated
  USING (is_verified = true OR id = auth.uid() OR public.is_admin());

CREATE POLICY "suppliers_own_update"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "suppliers_admin_insert"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

CREATE POLICY "suppliers_admin_delete"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- buyers: own read/write; admin all
CREATE POLICY "buyers_select_own_or_admin"
  ON public.buyers FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "buyers_update_own_or_admin"
  ON public.buyers FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "buyers_admin_insert"
  ON public.buyers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

CREATE POLICY "buyers_admin_delete"
  ON public.buyers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- fabric_categories: public read; admin write
CREATE POLICY "fabric_categories_public_read"
  ON public.fabric_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "fabric_categories_admin_insert"
  ON public.fabric_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "fabric_categories_admin_update"
  ON public.fabric_categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "fabric_categories_admin_delete"
  ON public.fabric_categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- fabric_attributes: public read; admin write
CREATE POLICY "fabric_attributes_public_read"
  ON public.fabric_attributes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "fabric_attributes_admin_insert"
  ON public.fabric_attributes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "fabric_attributes_admin_update"
  ON public.fabric_attributes FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "fabric_attributes_admin_delete"
  ON public.fabric_attributes FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- products: published public/private domain rules; supplier own; admin all
CREATE POLICY "products_public_read"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR public.is_supplier_owner(supplier_id)
    OR (
      status = 'published'
      AND (
        visibility = 'public'
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.product_private_domains ppd
            WHERE ppd.product_id = products.id
              AND ppd.domain = public.get_buyer_domain()
          )
        )
      )
    )
  );

CREATE POLICY "products_supplier_update"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_supplier_owner(supplier_id) OR public.is_admin())
  WITH CHECK (public.is_supplier_owner(supplier_id) OR public.is_admin());

CREATE POLICY "products_admin_insert"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_supplier_owner(supplier_id));

CREATE POLICY "products_admin_delete"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- product_attributes: same visibility as parent product
CREATE POLICY "product_attributes_read"
  ON public.product_attributes FOR SELECT
  TO anon, authenticated
  USING (public.can_view_product(product_id));

CREATE POLICY "product_attributes_admin_supplier_write"
  ON public.product_attributes FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_attributes.product_id
        AND public.is_supplier_owner(p.supplier_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_attributes.product_id
        AND public.is_supplier_owner(p.supplier_id)
    )
  );

-- product_private_domains: admin all; buyer read matching domain
CREATE POLICY "product_private_domains_admin_all"
  ON public.product_private_domains FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "product_private_domains_buyer_read_own_domain"
  ON public.product_private_domains FOR SELECT
  TO authenticated
  USING (domain = public.get_buyer_domain());

-- listing_requests: supplier own; admin all
CREATE POLICY "listing_requests_supplier_read"
  ON public.listing_requests FOR SELECT
  TO authenticated
  USING (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "listing_requests_supplier_insert"
  ON public.listing_requests FOR INSERT
  TO authenticated
  WITH CHECK (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "listing_requests_supplier_update"
  ON public.listing_requests FOR UPDATE
  TO authenticated
  USING (supplier_id = auth.uid() OR public.is_admin())
  WITH CHECK (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "listing_requests_admin_delete"
  ON public.listing_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- inquiries: buyer own; supplier own; admin read all
CREATE POLICY "inquiries_party_read"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "inquiries_buyer_insert"
  ON public.inquiries FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid() OR public.is_admin());

CREATE POLICY "inquiries_party_update"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid() OR public.is_admin())
  WITH CHECK (buyer_id = auth.uid() OR supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "inquiries_admin_delete"
  ON public.inquiries FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- inquiry_items: same as inquiries
CREATE POLICY "inquiry_items_read"
  ON public.inquiry_items FOR SELECT
  TO authenticated
  USING (public.can_access_inquiry(inquiry_id));

CREATE POLICY "inquiry_items_insert"
  ON public.inquiry_items FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_inquiry(inquiry_id));

CREATE POLICY "inquiry_items_update"
  ON public.inquiry_items FOR UPDATE
  TO authenticated
  USING (public.can_access_inquiry(inquiry_id))
  WITH CHECK (public.can_access_inquiry(inquiry_id));

CREATE POLICY "inquiry_items_delete"
  ON public.inquiry_items FOR DELETE
  TO authenticated
  USING (public.can_access_inquiry(inquiry_id));

-- messages: inquiry parties read/write; admin read-only
CREATE POLICY "messages_party_read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.can_access_inquiry(inquiry_id));

CREATE POLICY "messages_party_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_inquiry(inquiry_id)
    AND NOT public.is_admin()
  );

CREATE POLICY "messages_party_update"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    public.can_access_inquiry(inquiry_id)
    AND NOT public.is_admin()
  )
  WITH CHECK (
    public.can_access_inquiry(inquiry_id)
    AND NOT public.is_admin()
  );

-- cart_items: buyer own only
CREATE POLICY "cart_items_buyer_select"
  ON public.cart_items FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "cart_items_buyer_insert"
  ON public.cart_items FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND public.get_my_role() = 'buyer'
    AND public.can_view_product(product_id)
  );

CREATE POLICY "cart_items_buyer_update"
  ON public.cart_items FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "cart_items_buyer_delete"
  ON public.cart_items FOR DELETE
  TO authenticated
  USING (buyer_id = auth.uid());

-- invoices: buyer read own; supplier read/write own; admin all
CREATE POLICY "invoices_party_read"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "invoices_supplier_insert"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "invoices_supplier_update"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (supplier_id = auth.uid() OR public.is_admin())
  WITH CHECK (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "invoices_admin_delete"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- notifications: user reads own only
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- recent_views: user reads own; anyone can insert for tracking
CREATE POLICY "recent_views_select_own"
  ON public.recent_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "recent_views_insert"
  ON public.recent_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
    OR public.is_admin()
  );

CREATE POLICY "recent_views_update"
  ON public.recent_views FOR UPDATE
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
    OR public.is_admin()
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
    OR public.is_admin()
  );

CREATE POLICY "recent_views_delete_own"
  ON public.recent_views FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- page_presence: user writes own; admin reads all
CREATE POLICY "page_presence_select_admin"
  ON public.page_presence FOR SELECT
  TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "page_presence_upsert_own"
  ON public.page_presence FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "page_presence_update_own"
  ON public.page_presence FOR UPDATE
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
  );

CREATE POLICY "page_presence_delete_admin"
  ON public.page_presence FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- supplier_page_views: supplier reads own; admin reads all; anon/authenticated insert
CREATE POLICY "supplier_page_views_supplier_read"
  ON public.supplier_page_views FOR SELECT
  TO authenticated
  USING (supplier_id = auth.uid() OR public.is_admin());

CREATE POLICY "supplier_page_views_insert"
  ON public.supplier_page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- whatsapp_log: admin read; service/admin insert
CREATE POLICY "whatsapp_log_admin_read"
  ON public.whatsapp_log FOR SELECT
  TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "whatsapp_log_admin_insert"
  ON public.whatsapp_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- fx_rates: public read; admin write
CREATE POLICY "fx_rates_public_read"
  ON public.fx_rates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "fx_rates_admin_insert"
  ON public.fx_rates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "fx_rates_admin_update"
  ON public.fx_rates FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "fx_rates_admin_delete"
  ON public.fx_rates FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO public.color_families (slug, name, display_order) VALUES
  ('black',  'Black',  1),
  ('white',  'White',  2),
  ('gray',   'Gray',   3),
  ('beige',  'Beige',  4),
  ('brown',  'Brown',  5),
  ('red',    'Red',    6),
  ('orange', 'Orange', 7),
  ('yellow', 'Yellow', 8),
  ('green',  'Green',  9),
  ('blue',   'Blue',   10),
  ('purple', 'Purple', 11),
  ('pink',   'Pink',   12);

INSERT INTO public.fabric_categories (name, slug) VALUES
  ('Denim', 'denim'),
  ('Knit',  'knit'),
  ('Woven', 'woven');

-- =============================================================================
-- STORAGE BUCKET POLICIES (apply via Supabase Dashboard or separate migration)
-- =============================================================================
--
-- Buckets to create:
--   product-images       — public read, admin/supplier upload
--   scan-files           — private, admin-only
--   message-attachments  — private, inquiry parties
--   invoice-pdfs         — private, buyer + supplier
--
-- Example policies (storage.objects):
--
-- product-images (public bucket):
--   SELECT: bucket_id = 'product-images'
--   INSERT: bucket_id = 'product-images' AND (public.is_admin() OR auth.role() = 'authenticated')
--   UPDATE: bucket_id = 'product-images' AND public.is_admin()
--   DELETE: bucket_id = 'product-images' AND public.is_admin()
--
-- scan-files (private bucket):
--   SELECT/INSERT/UPDATE/DELETE: bucket_id = 'scan-files' AND public.is_admin()
--
-- message-attachments (private bucket):
--   SELECT: bucket_id = 'message-attachments' AND EXISTS (
--     SELECT 1 FROM public.messages m
--     JOIN public.inquiries i ON i.id = m.inquiry_id
--     WHERE m.attachments @> jsonb_build_array(jsonb_build_object('path', name))
--       AND (i.buyer_id = auth.uid() OR i.supplier_id = auth.uid())
--   )
--   INSERT: bucket_id = 'message-attachments' AND auth.uid() IS NOT NULL
--
-- invoice-pdfs (private bucket):
--   SELECT: bucket_id = 'invoice-pdfs' AND EXISTS (
--     SELECT 1 FROM public.invoices inv
--     WHERE inv.pdf_url LIKE '%' || name
--       AND (inv.buyer_id = auth.uid() OR inv.supplier_id = auth.uid() OR public.is_admin())
--   )
--   INSERT/UPDATE: bucket_id = 'invoice-pdfs' AND (
--     public.is_admin() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = auth.uid())
--   )
--
-- Note: Storage upsert requires INSERT + SELECT + UPDATE policies on the same bucket.

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_buyer_domain() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_product(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_inquiry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supplier_owner(uuid) TO authenticated, service_role;
