-- Audit trail for privileged admin actions (written by edge functions with
-- the service role; admins can read).

CREATE TABLE public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_id   uuid,
  target_type text,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_actor ON public.admin_audit_log (actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_admin_read"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());
