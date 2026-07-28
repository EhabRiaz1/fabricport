-- WS2 part 2: give sample requests a chat thread by reusing `messages`.
--
-- This is six coupled changes, not one ALTER. `messages.inquiry_id` was NOT NULL
-- and every policy keyed on can_access_inquiry(inquiry_id) -- and that function
-- returns FALSE for NULL, so without rewriting the policies a sample-thread
-- message would be both un-insertable AND invisible. The storage policy hard-codes
-- an `inquiry/{id}/...` prefix, so attachments needed a branch too.
--
-- `messages` is already in the supabase_realtime publication, so no publication
-- change is required -- sample threads get realtime for free.

alter table public.messages alter column inquiry_id drop not null;

alter table public.messages add column if not exists sample_request_id uuid
  references public.sample_requests(id) on delete cascade;

-- Exactly one parent. Without this, a row with both NULL would simply be
-- unreachable rather than rejected.
alter table public.messages drop constraint if exists messages_exactly_one_thread;
alter table public.messages add constraint messages_exactly_one_thread
  check (num_nonnulls(inquiry_id, sample_request_id) = 1);

create index if not exists idx_messages_sample_request
  on public.messages (sample_request_id);
-- Mirrors idx_messages_unread, which only covers inquiry threads.
create index if not exists idx_messages_sample_unread
  on public.messages (sample_request_id) where read_at is null;

-- `NOT is_admin()` is preserved from the original policies: admin oversight of
-- chat is deliberately read-only.
drop policy if exists messages_party_read   on public.messages;
create policy messages_party_read on public.messages
  for select to authenticated
  using (
    (inquiry_id is not null and public.can_access_inquiry(inquiry_id))
    or (sample_request_id is not null and public.can_access_sample_request(sample_request_id))
  );

drop policy if exists messages_party_insert on public.messages;
create policy messages_party_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and not public.is_admin() and (
      (inquiry_id is not null and public.can_access_inquiry(inquiry_id))
      or (sample_request_id is not null and public.can_access_sample_request(sample_request_id))
    )
  );

drop policy if exists messages_party_update on public.messages;
create policy messages_party_update on public.messages
  for update to authenticated
  using (
    not public.is_admin() and (
      (inquiry_id is not null and public.can_access_inquiry(inquiry_id))
      or (sample_request_id is not null and public.can_access_sample_request(sample_request_id))
    )
  )
  with check (
    not public.is_admin() and (
      (inquiry_id is not null and public.can_access_inquiry(inquiry_id))
      or (sample_request_id is not null and public.can_access_sample_request(sample_request_id))
    )
  );

-- Attachments: add a `sample/{request_id}/...` branch alongside inquiry/ and support/.
drop policy if exists message_attachments_access on storage.objects;
create policy message_attachments_access on storage.objects
  for all to authenticated
  using (
    bucket_id = 'message-attachments' and (
      ((storage.foldername(name))[1] = 'inquiry'
        and can_access_inquiry(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'sample'
        and can_access_sample_request(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'support'
        and ((((storage.foldername(name))[2])::uuid = auth.uid()) or is_admin()))
    )
  )
  with check (
    bucket_id = 'message-attachments' and (
      ((storage.foldername(name))[1] = 'inquiry'
        and can_access_inquiry(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'sample'
        and can_access_sample_request(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'support'
        and ((((storage.foldername(name))[2])::uuid = auth.uid()) or is_admin()))
    )
  );
