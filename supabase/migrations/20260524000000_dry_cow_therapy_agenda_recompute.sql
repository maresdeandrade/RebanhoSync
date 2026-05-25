-- Terapia de Vaca Seca: recompute operacional com ativacao explicita.
-- Mantem o item clinico padrao fora da agenda automatica; materializa apenas
-- protocolo operacional da fazenda com gera_agenda=true e gate dry_off_reproductive_window.

create or replace function public.sanitario_recompute_dry_cow_therapy_agenda(
  _fazenda_id uuid,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;

  with current_candidates as (
    select
      a.fazenda_id,
      a.id as animal_id,
      public.render_sanitario_canonical_dedup_key(
        'animal',
        a.id,
        'terapia_vaca_seca',
        'secagem-intramamario',
        psi.version,
        'window',
        facts.expected_calving_date::text,
        null
      ) as candidate_dedup_key
    from public.animais a
    join public.protocolos_sanitarios ps
      on ps.fazenda_id = a.fazenda_id
     and ps.ativo
     and ps.deleted_at is null
    join public.protocolos_sanitarios_itens psi
      on psi.fazenda_id = ps.fazenda_id
     and psi.protocolo_id = ps.id
     and psi.gera_agenda
     and psi.deleted_at is null
    cross join lateral (
      select
        coalesce(a.payload #>> '{taxonomy_facts,em_lactacao}', a.payload->>'em_lactacao') as em_lactacao_raw,
        coalesce(a.payload #>> '{taxonomy_facts,secagem_realizada}', a.payload->>'secagem_realizada') as secagem_realizada_raw,
        coalesce(a.payload #>> '{taxonomy_facts,data_prevista_parto}', a.payload->>'data_prevista_parto') as expected_calving_raw
    ) raw_facts
    cross join lateral (
      select
        lower(coalesce(raw_facts.em_lactacao_raw, '')) in ('true', '1', 'sim', 'yes') as em_lactacao,
        lower(coalesce(raw_facts.secagem_realizada_raw, '')) in ('true', '1', 'sim', 'yes') as secagem_realizada,
        case
          when left(coalesce(raw_facts.expected_calving_raw, ''), 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then left(raw_facts.expected_calving_raw, 10)::date
        end as expected_calving_date
    ) facts
    cross join lateral (
      select
        lower(nullif(coalesce(
          psi.payload->>'family_code',
          psi.payload #>> '{regime_sanitario,family_code}'
        ), '')) as family_code,
        lower(replace(nullif(coalesce(
          psi.payload->>'item_code',
          psi.payload->>'official_item_code',
          psi.payload #>> '{regime_sanitario,milestone_code}'
        ), ''), '_', '-')) as item_code,
        lower(nullif(psi.payload #>> '{agenda_activation,mode}', '')) as agenda_activation_mode
    ) rule
    where a.fazenda_id = _fazenda_id
      and (_animal_id is null or a.id = _animal_id)
      and a.deleted_at is null
      and a.status = 'ativo'
      and a.sexo = 'F'::public.sexo_enum
      and facts.em_lactacao
      and not facts.secagem_realizada
      and facts.expected_calving_date is not null
      and (facts.expected_calving_date - _as_of) between 45 and 75
      and rule.family_code = 'terapia_vaca_seca'
      and rule.item_code = 'secagem-intramamario'
      and rule.agenda_activation_mode = 'dry_off_reproductive_window'
  )
  update public.agenda_itens ai
  set
    status = 'cancelado'::public.agenda_status_enum,
    deleted_at = coalesce(ai.deleted_at, now()),
    payload = coalesce(ai.payload, '{}'::jsonb) || jsonb_build_object(
      'auto_cancel_reason',
      'dry_cow_therapy_recompute_invalidated',
      'auto_cancelled_at',
      now()
    )
  where ai.fazenda_id = _fazenda_id
    and (_animal_id is null or ai.animal_id = _animal_id)
    and ai.dominio = 'sanitario'
    and ai.status = 'agendado'
    and ai.deleted_at is null
    and ai.source_kind = 'automatico'
    and ai.source_evento_id is null
    and coalesce(
      ai.payload->>'family_code',
      ai.payload #>> '{regime_sanitario,family_code}'
    ) = 'terapia_vaca_seca'
    and coalesce(ai.payload->>'item_code', '') = 'secagem-intramamario'
    and (
      not exists (
        select 1
        from current_candidates cc
        where cc.fazenda_id = ai.fazenda_id
          and cc.animal_id = ai.animal_id
          and cc.candidate_dedup_key = ai.dedup_key
      )
      or exists (
        select 1
        from public.eventos e
        left join public.eventos_sanitario es
          on es.evento_id = e.id
         and es.fazenda_id = e.fazenda_id
         and es.deleted_at is null
        where e.fazenda_id = ai.fazenda_id
          and e.animal_id = ai.animal_id
          and e.dominio = 'sanitario'
          and e.deleted_at is null
          and coalesce(
            e.payload #>> '{dry_cow_therapy,dry_off_dedup_key}',
            es.payload #>> '{dry_cow_therapy,dry_off_dedup_key}'
          ) = ai.dedup_key
      )
    );

  with candidates as (
    select
      a.fazenda_id,
      a.id as animal_id,
      ps.id as protocolo_id,
      psi.id as protocolo_item_id,
      psi.protocol_item_id as protocol_item_version_ref,
      psi.tipo,
      psi.version,
      greatest(_as_of, facts.expected_calving_date - 60) as due_date,
      facts.expected_calving_date,
      (facts.expected_calving_date - 60) as dry_off_target_date,
      public.render_sanitario_canonical_dedup_key(
        'animal',
        a.id,
        'terapia_vaca_seca',
        'secagem-intramamario',
        psi.version,
        'window',
        facts.expected_calving_date::text,
        null
      ) as candidate_dedup_key,
      psi.payload
    from public.animais a
    join public.protocolos_sanitarios ps
      on ps.fazenda_id = a.fazenda_id
     and ps.ativo
     and ps.deleted_at is null
    join public.protocolos_sanitarios_itens psi
      on psi.fazenda_id = ps.fazenda_id
     and psi.protocolo_id = ps.id
     and psi.gera_agenda
     and psi.deleted_at is null
    cross join lateral (
      select
        coalesce(a.payload #>> '{taxonomy_facts,em_lactacao}', a.payload->>'em_lactacao') as em_lactacao_raw,
        coalesce(a.payload #>> '{taxonomy_facts,secagem_realizada}', a.payload->>'secagem_realizada') as secagem_realizada_raw,
        coalesce(a.payload #>> '{taxonomy_facts,data_prevista_parto}', a.payload->>'data_prevista_parto') as expected_calving_raw
    ) raw_facts
    cross join lateral (
      select
        lower(coalesce(raw_facts.em_lactacao_raw, '')) in ('true', '1', 'sim', 'yes') as em_lactacao,
        lower(coalesce(raw_facts.secagem_realizada_raw, '')) in ('true', '1', 'sim', 'yes') as secagem_realizada,
        case
          when left(coalesce(raw_facts.expected_calving_raw, ''), 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then left(raw_facts.expected_calving_raw, 10)::date
        end as expected_calving_date
    ) facts
    cross join lateral (
      select
        lower(nullif(coalesce(
          psi.payload->>'family_code',
          psi.payload #>> '{regime_sanitario,family_code}'
        ), '')) as family_code,
        lower(replace(nullif(coalesce(
          psi.payload->>'item_code',
          psi.payload->>'official_item_code',
          psi.payload #>> '{regime_sanitario,milestone_code}'
        ), ''), '_', '-')) as item_code,
        lower(nullif(psi.payload #>> '{agenda_activation,mode}', '')) as agenda_activation_mode
    ) rule
    where a.fazenda_id = _fazenda_id
      and (_animal_id is null or a.id = _animal_id)
      and a.deleted_at is null
      and a.status = 'ativo'
      and a.sexo = 'F'::public.sexo_enum
      and facts.em_lactacao
      and not facts.secagem_realizada
      and facts.expected_calving_date is not null
      and (facts.expected_calving_date - _as_of) between 45 and 75
      and rule.family_code = 'terapia_vaca_seca'
      and rule.item_code = 'secagem-intramamario'
      and rule.agenda_activation_mode = 'dry_off_reproductive_window'
  )
  insert into public.agenda_itens (
    fazenda_id, dominio, tipo, status, data_prevista, animal_id, dedup_key,
    source_kind, source_ref, protocol_item_version_id, interval_days_applied,
    payload, client_id, client_recorded_at, server_received_at
  )
  select
    c.fazenda_id,
    'sanitario'::public.dominio_enum,
    c.tipo::text,
    'agendado'::public.agenda_status_enum,
    c.due_date,
    c.animal_id,
    c.candidate_dedup_key,
    'automatico'::public.agenda_source_kind_enum,
    jsonb_build_object('protocolo_id', c.protocolo_id, 'protocol_item_id', c.protocolo_item_id),
    c.protocolo_item_id,
    60,
    (c.payload - 'family_code') ||
      jsonb_build_object(
        'item_code', 'secagem-intramamario',
        'official_item_code', 'secagem-intramamario',
        'regime_sanitario', jsonb_build_object(
          'family_code', 'terapia_vaca_seca',
          'milestone_code', 'secagem-intramamario',
          'schedule_rule', jsonb_build_object(
            'kind', 'dry_off_reproductive_window',
            'anchor_fact', 'taxonomy_facts.data_prevista_parto',
            'due_days_before_calving', 60
          )
        ),
        'materialization_contract_version', 1,
        'anchor_fact', 'taxonomy_facts.data_prevista_parto',
        'expected_calving_date', c.expected_calving_date::text,
        'dry_off_target_date', c.dry_off_target_date::text,
        'dry_off_dedup_key', c.candidate_dedup_key,
        'agenda_materialization_allowed', true,
        'source', 'dry_cow_therapy_sql_recompute'
      ),
    'server',
    now(),
    now()
  from candidates c
  where not exists (
    select 1
    from public.agenda_itens ai
    where ai.fazenda_id = c.fazenda_id
      and ai.dedup_key = c.candidate_dedup_key
      and ai.status = 'concluido'
      and ai.deleted_at is null
      and ai.source_evento_id is not null
      and exists (
        select 1
        from public.eventos e
        join public.eventos_sanitario es
          on es.evento_id = e.id
         and es.fazenda_id = e.fazenda_id
        where e.id = ai.source_evento_id
          and e.fazenda_id = ai.fazenda_id
          and e.deleted_at is null
          and es.deleted_at is null
      )
  )
  and not exists (
    select 1
    from public.eventos e
    left join public.eventos_sanitario es
      on es.evento_id = e.id
     and es.fazenda_id = e.fazenda_id
     and es.deleted_at is null
    where e.fazenda_id = c.fazenda_id
      and e.animal_id = c.animal_id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
      and coalesce(
        e.payload #>> '{dry_cow_therapy,dry_off_dedup_key}',
        es.payload #>> '{dry_cow_therapy,dry_off_dedup_key}'
      ) = c.candidate_dedup_key
  )
  on conflict (fazenda_id, dedup_key)
  where status = 'agendado' and deleted_at is null and dedup_key is not null
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

do $$
begin
  if to_regprocedure('public.sanitario_recompute_agenda_core_without_dry_cow(uuid,uuid,date)') is null then
    alter function public.sanitario_recompute_agenda_core(uuid, uuid, date)
      rename to sanitario_recompute_agenda_core_without_dry_cow;
  end if;
end;
$$;

create or replace function public.sanitario_recompute_agenda_core(
  _fazenda_id uuid,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  base_inserted_count integer := 0;
  dry_cow_inserted_count integer := 0;
begin
  if not public.has_membership(_fazenda_id) then
    raise exception 'Forbidden';
  end if;

  base_inserted_count := public.sanitario_recompute_agenda_core_without_dry_cow(
    _fazenda_id,
    _animal_id,
    _as_of
  );
  dry_cow_inserted_count := public.sanitario_recompute_dry_cow_therapy_agenda(
    _fazenda_id,
    _animal_id,
    _as_of
  );

  return base_inserted_count + dry_cow_inserted_count;
end;
$$;

comment on function public.sanitario_recompute_dry_cow_therapy_agenda(uuid, uuid, date)
is 'Materializa agenda de Terapia de Vaca Seca apenas para protocolo operacional ativado, com dedup por ciclo de parto e bloqueios anti-agenda-zumbi.';
