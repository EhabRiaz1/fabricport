-- Digital fabric (.zfab) downloads, mirrored from the legacy fabricport.com catalogue.
--
-- The old site offered "Download Digital Fabric File" on 71 of its 454 product pages: a
-- .zfab a designer opens directly in CLO 3D or Marvelous Designer. That was the one thing
-- the legacy catalogue could do that this one could not, so the files move here rather
-- than being linked back to a site that will eventually be switched off.
--
-- ADDITIVE ONLY. This creates a new bucket and its policies. It touches no existing
-- bucket, table, column or row, and contains no drop/delete/truncate of anything that
-- already exists. `products.scan_files` is already in the schema (001_initial_schema.sql)
-- and is `[]` on every row today, so the import has nothing to overwrite.
--
-- Sizing: the 71 legacy files total ~1.22 GB, average 17.6 MB, largest 39 MB. 50 MB is the
-- per-object ceiling, matching product-videos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digital-fabrics', 'digital-fabrics', true, 52428800,  -- 50 MB
  -- .zfab has no registered media type; Supabase requires the upload's declared type to
  -- be listed, and octet-stream is what the legacy server sent (application/download).
  array['application/octet-stream','application/zip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read is handled by the public-bucket endpoint and needs no SELECT policy; this
-- is the admin write path, matching product-images / product-videos. The import script
-- runs as the service role and bypasses RLS entirely.
drop policy if exists digital_fabrics_admin_write on storage.objects;
create policy digital_fabrics_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'digital-fabrics' and is_admin())
  with check (bucket_id = 'digital-fabrics' and is_admin());

comment on column public.products.scan_files is
  'Digital fabric files in the digital-fabrics bucket, as <productId>/<name>.zfab. '
  'Populated by scripts/import-legacy-zfab.ts from the legacy catalogue.';
