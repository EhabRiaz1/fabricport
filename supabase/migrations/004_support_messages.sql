-- Direct support conversations between the FabricPort team (admins) and any
-- user. Separate from inquiry messages so admins can initiate outreach.

CREATE TABLE public.support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  content    text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_user ON public.support_messages (user_id, created_at DESC);
CREATE INDEX idx_support_messages_unread ON public.support_messages (user_id) WHERE read_at IS NULL;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- The user the thread belongs to, or any admin, can read.
CREATE POLICY "support_messages_read"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- The thread owner can write into their own thread; admins can write into any.
CREATE POLICY "support_messages_insert"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (user_id = auth.uid() OR public.is_admin())
  );

-- Read receipts: thread owner or admin can mark read.
CREATE POLICY "support_messages_update"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
