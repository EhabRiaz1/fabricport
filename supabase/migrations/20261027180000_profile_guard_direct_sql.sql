-- guard_profile_admin_columns blocked direct SQL (dashboard / operator sessions),
-- which carry no API JWT and so are neither service_role nor an admin user.
-- Treat a session with no JWT claims as privileged; API callers always have them.
create or replace function public.guard_profile_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role')
     or public.is_admin()
     or current_setting('request.jwt.claims', true) is null then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.overdue_flagged is distinct from old.overdue_flagged
     or new.overdue_flagged_at is distinct from old.overdue_flagged_at then
    raise exception 'not permitted to modify admin-controlled profile columns'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_admin_columns() from public, anon, authenticated;
