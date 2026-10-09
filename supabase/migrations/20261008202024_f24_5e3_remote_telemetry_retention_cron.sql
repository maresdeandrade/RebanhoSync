-- F24.5E3: versioned Supabase Cron activation. Apply only with remote approval.
create extension if not exists pg_cron with schema pg_catalog;

-- Schedule as the maintenance owner, never as an API/end-user role.
-- Fail closed if cron's timezone/logging does not match this audit contract.
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Telemetry retention must be scheduled as postgres';
  end if;
  if current_setting('cron.timezone') not in ('GMT', 'UTC') then
    raise exception 'Telemetry retention requires cron.timezone GMT or UTC';
  end if;
  if current_setting('cron.log_run') <> 'on' then
    raise exception 'Telemetry retention requires cron.log_run=on';
  end if;
end;
$$;

-- Named schedule is upserted by pg_cron, preventing duplicate schedules on retry.
-- One bounded batch daily at 03:00 UTC (00:00 America/Sao_Paulo).
select cron.schedule(
  'metrics-events-retention-daily',
  '0 3 * * *',
  'SELECT public.purge_expired_metrics_events();'
);
