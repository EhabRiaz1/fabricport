-- Fix #9: the USD→PKR rate only refreshed when an admin pressed the button.
-- A pg_cron job now calls the refresh-fx-rates edge function every day at
-- 03:00 UTC (08:00 PKT). Nothing secret is stored in this file: the project URL
-- and the cron secret are read from Supabase Vault at run time.
--
-- One-time setup (dashboard → Project Settings → Vault, or SQL as postgres):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<long random string>',                'cron_secret');
-- and set the same string as the CRON_SECRET secret on the refresh-fx-rates
-- edge function (dashboard → Edge Functions → refresh-fx-rates → Secrets).
--
-- The job is a no-op (logs a notice) until both vault entries exist.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

grant usage on schema cron to postgres;

create or replace function public.cron_refresh_fx_rates()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'cron_secret' limit 1;

  if v_url is null or v_secret is null then
    raise notice 'cron_refresh_fx_rates: vault secrets project_url / cron_secret not set, skipping';
    return;
  end if;

  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/refresh-fx-rates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;
revoke execute on function public.cron_refresh_fx_rates() from public, anon, authenticated;

-- Idempotent: drop any previous schedule under the same name before adding.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-fx-rates-daily') then
    perform cron.unschedule('refresh-fx-rates-daily');
  end if;
end;
$$;

select cron.schedule(
  'refresh-fx-rates-daily',
  '0 3 * * *',
  $$ select public.cron_refresh_fx_rates(); $$
);
