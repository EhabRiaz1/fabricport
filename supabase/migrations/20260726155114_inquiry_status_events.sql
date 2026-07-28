-- WS1: make inquiry status actually alive. Until now `status` was inserted as
-- 'open' and never transitioned anywhere -- no updater, no trigger -- so four of
-- the five enum values were unreachable and the dashboards that filter on them
-- always returned 0.

create table if not exists public.inquiry_status_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  from_status text,
  to_status text not null,
  -- eng-M6: nullable on purpose. A future service-role status change has no
  -- auth.uid(); such callers must pass the acting admin id explicitly.
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inquiry_status_events_inquiry
  on public.inquiry_status_events (inquiry_id, created_at desc);

alter table public.inquiry_status_events enable row level security;
revoke all on public.inquiry_status_events from anon;

-- Read-only to clients. There is deliberately NO insert/update/delete policy:
-- the SECURITY DEFINER trigger below is the only writer, so the audit trail
-- cannot be forged or rewritten from the client.
drop policy if exists inquiry_status_events_party_read on public.inquiry_status_events;
create policy inquiry_status_events_party_read on public.inquiry_status_events
  for select to authenticated using (public.can_access_inquiry(inquiry_id));

-- eng-H1: SECURITY DEFINER is required. As INVOKER the insert would be evaluated
-- against the (deliberately absent) INSERT policy and roll back the user's write.
create or replace function public.log_inquiry_status_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inquiry_status_events(inquiry_id, from_status, to_status, actor_id)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;
  -- eng-M5: only log real transitions.
  if new.status is distinct from old.status then
    insert into public.inquiry_status_events(inquiry_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists inquiries_log_status_event on public.inquiries;
create trigger inquiries_log_status_event
  after insert or update of status on public.inquiries
  for each row execute function public.log_inquiry_status_event();

-- inquiries_party_update is row-scoped with no column restriction, so either
-- party could rewrite buyer_id/supplier_id or set any status. WS1 is what first
-- exposes a status control in the UI, so the guard lands with it.
create or replace function public.guard_inquiry_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then return new; end if;

  if new.buyer_id is distinct from old.buyer_id
     or new.supplier_id is distinct from old.supplier_id then
    raise exception 'not permitted to reassign inquiry parties' using errcode = '42501';
  end if;

  -- Advancing the deal is the supplier's call. A buyer may only end their own.
  if new.status is distinct from old.status
     and auth.uid() = old.buyer_id
     and new.status not in ('closed','archived') then
    raise exception 'buyers may only close or archive an inquiry' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists inquiries_guard_admin_columns on public.inquiries;
create trigger inquiries_guard_admin_columns
  before update on public.inquiries
  for each row execute function public.guard_inquiry_admin_columns();

revoke execute on function public.log_inquiry_status_event()    from public, anon, authenticated;
revoke execute on function public.guard_inquiry_admin_columns() from public, anon, authenticated;

-- Backfill a creation event for inquiries that predate the trigger, so no
-- timeline renders empty. actor_id is unknown for these, hence nullable.
insert into public.inquiry_status_events (inquiry_id, from_status, to_status, actor_id, created_at)
select i.id, null, i.status, null, i.created_at
from public.inquiries i
where not exists (
  select 1 from public.inquiry_status_events e where e.inquiry_id = i.id
);
