-- F24.5E3: additive, server-authoritative retention clock. No RLS/client changes.
-- Existing rows receive this transaction's timestamp, never client created_at.
alter table public.metrics_events
  add column server_received_at timestamptz not null default now();

comment on column public.metrics_events.server_received_at is
  'First server ingestion; existing rows conservatively stamped at migration. Retention clock, not domain history.';

create function public.stamp_metrics_server_received_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.server_received_at := now();
  return new;
end;
$$;

revoke all on function public.stamp_metrics_server_received_at() from public, anon, authenticated, service_role;

create trigger metrics_events_stamp_server_received_at
before insert on public.metrics_events
for each row execute function public.stamp_metrics_server_received_at();

create index idx_metrics_events_server_received_id
  on public.metrics_events (server_received_at, id);

-- No suitable application-internal schema exists. Execution is restricted to
-- the maintenance owner; SECURITY INVOKER does not grant caller privileges.
create function public.purge_expired_metrics_events()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
  deleted_count integer;
begin
  with candidates as materialized (
    select m.id
    from public.metrics_events m
    where m.server_received_at < cutoff
    order by m.server_received_at, m.id
    limit 1000
    for update skip locked
  )
  delete from public.metrics_events m
  using candidates c
  where m.id = c.id and m.server_received_at < cutoff;

  get diagnostics deleted_count = row_count;
  raise log 'metrics_events retention: deleted_count=%, cutoff=%', deleted_count, cutoff;
  return deleted_count;
end;
$$;

alter function public.stamp_metrics_server_received_at() owner to postgres;
alter function public.purge_expired_metrics_events() owner to postgres;
revoke all on function public.purge_expired_metrics_events() from public, anon, authenticated, service_role;

comment on function public.purge_expired_metrics_events() is
  'Maintenance-only: delete at most 1000 rows older than 30 days since first ingestion. Late replay after purge may insert again; no permanent deduplication ledger.';
