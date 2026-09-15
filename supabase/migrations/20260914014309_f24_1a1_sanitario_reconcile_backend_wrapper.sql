-- F24.1A.1 — Separate authenticated and backend authorization for the
-- legacy sanitary recompute entrypoint. The recompute remains a no-op after
-- the Agenda Sanitaria v2 cutover; this migration changes authorization only.

create or replace function public.internal_sanitario_recompute_agenda_core(
  _fazenda_id uuid,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select 0;
$$;

revoke execute on function public.internal_sanitario_recompute_agenda_core(uuid, uuid, date)
  from public, anon, authenticated, service_role;

create or replace function public.sanitario_recompute_agenda_core(
  _fazenda_id uuid,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;

  return public.internal_sanitario_recompute_agenda_core(
    _fazenda_id,
    _animal_id,
    _as_of
  );
end;
$$;

revoke execute on function public.sanitario_recompute_agenda_core(uuid, uuid, date)
  from public, anon, authenticated, service_role;

create or replace function public.internal_sanitario_recompute_agenda_for_fazenda(
  _fazenda_id uuid,
  _as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Backend authorization required'
      using errcode = '42501';
  end if;

  if _fazenda_id is null or not exists (
    select 1
    from public.fazendas f
    where f.id = _fazenda_id
      and f.deleted_at is null
  ) then
    raise exception 'Fazenda not found'
      using errcode = 'P0002';
  end if;

  return public.internal_sanitario_recompute_agenda_core(
    _fazenda_id,
    null,
    _as_of
  );
end;
$$;

revoke execute on function public.internal_sanitario_recompute_agenda_for_fazenda(uuid, date)
  from public, anon, authenticated, service_role;

grant execute on function public.internal_sanitario_recompute_agenda_for_fazenda(uuid, date)
  to service_role;

comment on function public.internal_sanitario_recompute_agenda_core(uuid, uuid, date) is
  'Internal no-op recompute implementation after Agenda Sanitaria v2 cutover; callable only through authorized wrappers.';

comment on function public.sanitario_recompute_agenda_core(uuid, uuid, date) is
  'Authenticated compatibility wrapper; validates farm membership before invoking the internal recompute core.';

comment on function public.internal_sanitario_recompute_agenda_for_fazenda(uuid, date) is
  'Server-only sanitary reconcile wrapper; validates service_role and the target farm before invoking the internal recompute core.';
