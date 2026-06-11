-- Supplier analytics: company-level visitor identity.
-- Suppliers cannot read other users' profiles directly (RLS), so this
-- SECURITY DEFINER function exposes aggregated visitor info for a supplier's
-- own catalogue only (owner or admin).

CREATE OR REPLACE FUNCTION public.get_supplier_visitor_stats(
  supplier_uuid uuid,
  since timestamptz DEFAULT now() - interval '30 days'
)
RETURNS TABLE (
  viewer_id uuid,
  company_name text,
  full_name text,
  viewer_role text,
  visit_count bigint,
  product_views bigint,
  last_visit timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.viewer_id,
    p.company_name,
    p.full_name,
    p.role::text AS viewer_role,
    count(*) AS visit_count,
    count(*) FILTER (WHERE v.product_id IS NOT NULL) AS product_views,
    max(v.viewed_at) AS last_visit
  FROM public.supplier_page_views v
  LEFT JOIN public.profiles p ON p.id = v.viewer_id
  WHERE v.supplier_id = supplier_uuid
    AND v.viewed_at >= since
    AND v.viewer_id IS NOT NULL
    AND (supplier_uuid = auth.uid() OR public.is_admin())
  GROUP BY v.viewer_id, p.company_name, p.full_name, p.role
  ORDER BY max(v.viewed_at) DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_visitor_stats(uuid, timestamptz) TO authenticated;
