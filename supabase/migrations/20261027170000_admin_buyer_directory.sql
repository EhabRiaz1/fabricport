-- Admin buyer directory with email addresses.
--
-- Emails live in auth.users, which the browser cannot read. The admin private
-- buyer picker only had names, so two buyers with the same company (or no
-- company at all; 58 of 119 had none) were indistinguishable. Admin-only.
create or replace function public.get_buyer_directory()
returns table (
  id uuid,
  full_name text,
  company_name text,
  email text,
  is_demo boolean,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.company_name, u.email::text, p.is_demo, p.status, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'buyer'
    and public.is_admin()
  order by coalesce(nullif(btrim(p.company_name), ''), nullif(btrim(p.full_name), ''), u.email);
$$;

revoke execute on function public.get_buyer_directory() from public, anon;
grant  execute on function public.get_buyer_directory() to authenticated;
