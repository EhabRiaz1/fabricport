-- "Running fabric": a line the mill keeps in continuous production, as opposed to a
-- one-off lot. Yes/No, shown as a marketplace facet. Every existing fabric starts as No.
-- Supplier-editable like sample_available, so it is not added to the admin-column guard.
alter table public.products
  add column if not exists is_running boolean not null default false;

comment on column public.products.is_running is
  'Running fabric (continuously produced line). Marketplace facet; editable by the supplier and admin.';
