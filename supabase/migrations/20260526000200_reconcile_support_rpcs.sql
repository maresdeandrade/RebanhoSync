-- Phase 1B: RPCs supporting the sanitario-reconcile Edge Function (F7)

-- Returns fazendas eligible for periodic reconciliation
create or replace function public.sanitario_reconcile_eligible_fazendas(_cooldown_cutoff timestamptz)
returns table (fazenda_id uuid)
language sql
security definer
set search_path = public
as $$
  select distinct a.fazenda_id
  from public.animais a
  where a.status = 'ativo'
    and a.deleted_at is null
    and exists (
      select 1
      from public.agenda_itens ai
      where ai.fazenda_id = a.fazenda_id
        and ai.dominio = 'sanitario'
        and ai.status = 'agendado'
        and ai.deleted_at is null
    )
    and (
      not exists (
        select 1
        from public.fazenda_sanidade_config fsc
        where fsc.fazenda_id = a.fazenda_id
          and fsc.deleted_at is null
          and (fsc.payload->>'last_reconcile_at') is not null
          and (fsc.payload->>'last_reconcile_at')::timestamptz >= _cooldown_cutoff
      )
    );
$$;

-- Touches last_reconcile_at in fazenda_sanidade_config.payload
create or replace function public.sanitario_reconcile_touch(_fazenda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fazenda_sanidade_config
  set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('last_reconcile_at', now()::text),
      updated_at = now()
  where fazenda_id = _fazenda_id;

  -- Insert config if it doesn't exist yet
  if not found then
    insert into public.fazenda_sanidade_config (fazenda_id, payload)
    values (_fazenda_id, jsonb_build_object('last_reconcile_at', now()::text))
    on conflict (fazenda_id) do update
    set payload = coalesce(fazenda_sanidade_config.payload, '{}'::jsonb) || jsonb_build_object('last_reconcile_at', now()::text),
        updated_at = now();
  end if;
end;
$$;
