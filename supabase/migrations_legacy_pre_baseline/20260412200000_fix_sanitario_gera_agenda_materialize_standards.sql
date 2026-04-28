-- 20260412200000_fix_sanitario_gera_agenda_materialize_standards.sql
--
-- FIXES:
-- 1. Raiva D2 (Reforco primovacinacao) should generate auto-agenda
--    Changed gera_agenda from false → true to match user expectations
--
-- 2. Add STANDARD_PROTOCOLS (Clostridioses, Reprodutiva, Controle Estrategico)
--    These are materialized as draft templates when farm creates first official pack

-- PART 1: Fix Raiva D2 gera_agenda flag
-- This affects existing farms that have seed protocols from 0027/0034
update public.protocolos_sanitarios_itens
set
  gera_agenda = true,
  payload = payload || jsonb_build_object(
    'fixed_gera_agenda', true,
    'fix_timestamp', now()::text,
    'fix_reason', 'Raiva D2 (reforco) deve gerar agenda automatica para melhor UX'
  ),
  updated_at = now()
where
  (
    (payload->>'item_code' = 'RAIVA_PRIMOVAC_D2'
    or produto ilike '%antirrabica%reforco%')
    or dedup_template ilike '%raiva:%:d2%'
  )
  and gera_agenda = false
  and deleted_at is null;

-- PART 2: Create helper function to materialize standard protocols
create or replace function public.materialize_standard_sanitary_protocols(
  _fazenda_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id constant text := 'system:materialize:standard-protocols:v1';
  v_now timestamptz := now();
  v_seed_tx_id uuid := gen_random_uuid();
  v_protocol_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtext('materialize_standard_sanitary_protocols'),
    hashtext(_fazenda_id::text)
  );

  -- Check if already materialized to avoid duplication
  if exists(
    select 1 from public.protocolos_sanitarios
    where fazenda_id = _fazenda_id
      and (payload->>'canonical_code' in ('clostridioses', 'reproducao', 'controle_estrategico'))
      and deleted_at is null
  ) then
    return;
  end if;

  -- Clostridioses (Clostridium perfringens, novyi, etc.)
  -- Draft state - user must activate
  v_protocol_id := gen_random_uuid();
  insert into public.protocolos_sanitarios (
    id, fazenda_id, nome, descricao, ativo, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at
  ) values (
    v_protocol_id, _fazenda_id,
    'Clostridioses (Controle Preventivo)',
    'Protocolo de prevenção de clostridioses via vacinação. Ativar conforme estrutura do rebanho.',
    false,
    jsonb_build_object(
      'origem', 'standard_protocol',
      'canonical_code', 'clostridioses',
      'scope', 'farm',
      'status', 'draft',
      'activation_mode', 'manual',
      'descricao_operacional', 'Vacinação contra Clostridium perfringens tipos C-D, novyi, septicum conforme idade e sistema de produção'
    ),
    v_client_id, gen_random_uuid(), v_seed_tx_id, v_now
  );

  -- Reprodução (Sincronização, Monitoramento)
  v_protocol_id := gen_random_uuid();
  insert into public.protocolos_sanitarios (
    id, fazenda_id, nome, descricao, ativo, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at
  ) values (
    v_protocol_id, _fazenda_id,
    'Protocolo Reprodutivo',
    'Gestão integrada de reprodução: sincronização de cios, monitoramento de gestação, vigilância reprodutiva.',
    false,
    jsonb_build_object(
      'origem', 'standard_protocol',
      'canonical_code', 'reproducao',
      'scope', 'farm',
      'status', 'draft',
      'activation_mode', 'manual',
      'descricao_operacional', 'Monitoramento de ciclos estruais, cobertura, gestação e parto. Integração com eventos de reprodução.'
    ),
    v_client_id, gen_random_uuid(), v_seed_tx_id, v_now
  );

  -- Controle Estrategico (Integração Epidemiológica)
  v_protocol_id := gen_random_uuid();
  insert into public.protocolos_sanitarios (
    id, fazenda_id, nome, descricao, ativo, payload,
    client_id, client_op_id, client_tx_id, client_recorded_at
  ) values (
    v_protocol_id, _fazenda_id,
    'Controle Estratégico (Epidemiologia)',
    'Ajustes de protocolos sanitários baseados em análise epidemiológica: sazonalidade, pressão de parasitos, histórico.',
    false,
    jsonb_build_object(
      'origem', 'standard_protocol',
      'canonical_code', 'controle_estrategico',
      'scope', 'farm',
      'status', 'draft',
      'activation_mode', 'manual',
      'descricao_operacional', 'Revisão periódica e ajuste de frequências de vacinação e medicação conforme indicadores epidemiológicos da fazenda'
    ),
    v_client_id, gen_random_uuid(), v_seed_tx_id, v_now
  );
end;
$$;

grant execute on function public.materialize_standard_sanitary_protocols(uuid)
to service_role;

-- Materialize standards for existing farms
do $$
declare
  v_fazenda_id uuid;
begin
  for v_fazenda_id in (
    select distinct id
    from public.fazendas
    where deleted_at is null
    order by created_at
  ) loop
    begin
      perform public.materialize_standard_sanitary_protocols(v_fazenda_id);
    exception when others then
      raise warning 'Failed to materialize standard protocols for farm %: %',
        v_fazenda_id, sqlerrm;
    end;
  end loop;
end;
$$;

-- PART 3: Hook into official pack activation to also materialize standards
-- (This will be called from officialCatalog.ts buildOfficialSanitaryPackOps sync flow)
-- No migration hook needed - handled in application logic via activateOfficialSanitaryPack()

comment on function public.materialize_standard_sanitary_protocols(uuid) is
  'Materialize draft STANDARD_PROTOCOLS (Clostridioses, Reprodução, Controle Estratégico) for offline-first system. Called during official pack activation.';
