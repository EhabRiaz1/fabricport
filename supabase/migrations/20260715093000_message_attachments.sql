-- W4: Chat file attachments. The bucket documented in 001 was never created;
-- this creates it for real (private) plus RLS gating read/write to the parties
-- of the inquiry (or, for support, the user and admins). Attachments are served
-- via short-lived signed URLs (see src/lib/attachments.ts), never public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments', 'message-attachments', false, 20971520,  -- 20 MB
  array[
    'application/pdf','image/jpeg','image/png','image/webp',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path convention:
--   inquiry/{inquiry_id}/{uuid}-{filename}
--   support/{user_id}/{uuid}-{filename}
drop policy if exists message_attachments_access on storage.objects;
create policy message_attachments_access on storage.objects
for all to authenticated
using (
  bucket_id = 'message-attachments'
  and (
    ((storage.foldername(name))[1] = 'inquiry'
      and public.can_access_inquiry(((storage.foldername(name))[2])::uuid))
    or
    ((storage.foldername(name))[1] = 'support'
      and (((storage.foldername(name))[2])::uuid = auth.uid() or public.is_admin()))
  )
)
with check (
  bucket_id = 'message-attachments'
  and (
    ((storage.foldername(name))[1] = 'inquiry'
      and public.can_access_inquiry(((storage.foldername(name))[2])::uuid))
    or
    ((storage.foldername(name))[1] = 'support'
      and (((storage.foldername(name))[2])::uuid = auth.uid() or public.is_admin()))
  )
);

-- Support threads can carry attachments too (invoices/reports to admins).
alter table public.support_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
