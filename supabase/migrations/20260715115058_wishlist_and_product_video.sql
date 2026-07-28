-- W6a: Buyer wishlist. Mirrors cart_items exactly (unique buyer_id+product_id),
-- logged-in buyers only.
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, product_id)
);

alter table public.wishlist_items enable row level security;

drop policy if exists wishlist_items_buyer_select on public.wishlist_items;
create policy wishlist_items_buyer_select on public.wishlist_items
  for select using (buyer_id = auth.uid());

drop policy if exists wishlist_items_buyer_insert on public.wishlist_items;
create policy wishlist_items_buyer_insert on public.wishlist_items
  for insert with check (
    buyer_id = auth.uid() and get_my_role() = 'buyer' and can_view_product(product_id)
  );

drop policy if exists wishlist_items_buyer_delete on public.wishlist_items;
create policy wishlist_items_buyer_delete on public.wishlist_items
  for delete using (buyer_id = auth.uid());

create index if not exists wishlist_items_buyer_idx on public.wishlist_items (buyer_id);

-- W6b: Admin-uploaded product video, played on the public product page.
alter table public.products add column if not exists video_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', true, 52428800,  -- 50 MB
  array['video/mp4','video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admin write access for media buckets (public read is handled by the public
-- bucket endpoint and needs no SELECT policy). product-images gets the same so
-- admin uploads from the app work under RLS, not only via the service role.
drop policy if exists product_videos_admin_write on storage.objects;
create policy product_videos_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-videos' and is_admin())
  with check (bucket_id = 'product-videos' and is_admin());

drop policy if exists product_images_admin_write on storage.objects;
create policy product_images_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());
