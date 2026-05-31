-- Phase 1A: Anti-Zombie Gate
-- Adds early cancellation of agenda items for inactive animals
-- inside sanitario_recompute_agenda_core, before the existing
-- non-materializable protocol cancellation block (lines 826-863).

create or replace function public.sanitario_recompute_agenda_core(_fazenda_id uuid, _animal_id uuid default null, _as_of date default current_date)
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

  -- F4: Anti-zombie gate — cancel agenda for inactive animals before any materialization
  update public.agenda_itens ai
  set
    status = 'cancelado'::public.agenda_status_enum,
    deleted_at = coalesce(ai.deleted_at, now()),
    payload = coalesce(ai.payload, '{}'::jsonb) || jsonb_build_object(
      'auto_cancel_reason', 'animal_inactive',
      'auto_cancelled_at', now()
    )
  where ai.fazenda_id = _fazenda_id
    and (_animal_id is null or ai.animal_id = _animal_id)
    and ai.dominio = 'sanitario'
    and ai.status = 'agendado'
    and ai.deleted_at is null
    and ai.animal_id is not null
    and exists (
      select 1
      from public.animais a
      where a.id = ai.animal_id
        and a.fazenda_id = ai.fazenda_id
        and a.status != 'ativo'
    );

  -- Existing: cancel non-materializable protocol families
  update public.agenda_itens ai
  set
    status = 'cancelado'::public.agenda_status_enum,
    deleted_at = coalesce(ai.deleted_at, now()),
    payload = coalesce(ai.payload, '{}'::jsonb) || jsonb_build_object(
      'auto_cancel_reason',
      'sanitario_recompute_invalidated_non_materializable_protocol',
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
    and (
      coalesce(ai.payload->>'family_code', '') in (
        'terapia_vaca_seca',
        'tristeza_parasitaria_bovina',
        'cura_umbigo'
      )
      or (
        coalesce(ai.payload->>'family_code', '') in (
          'controle_parasitario',
          'controle_estrategico_parasitas'
        )
        and coalesce(ai.payload #>> '{calendario_base,mode}', ai.payload->>'calendar_mode', '') in ('campaign', 'campanha')
        and jsonb_typeof(ai.payload #> '{calendario_base,months}') = 'array'
        and not exists (
          select 1
          from jsonb_array_elements_text(ai.payload #> '{calendario_base,months}') as month_entry(raw_value)
          where month_entry.raw_value ~ '^[0-9]+$'
            and month_entry.raw_value::integer = extract(month from _as_of)::integer
        )
      )
    );

  with sanitary_history as (
    select
      e.fazenda_id,
      e.animal_id,
      hnorm.family_code,
      hnorm.milestone_code,
      case
        when nullif(es.payload #>> '{sanitary_completion,completed_on}', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        then (es.payload #>> '{sanitary_completion,completed_on}')::date
        else (e.occurred_at at time zone 'America/Sao_Paulo')::date
      end as completed_on,
      es.payload #>> '{sanitary_completion,sanitary_completion_key}' as sanitary_completion_key
    from public.eventos e
    join public.eventos_sanitario es
      on es.evento_id = e.id
     and es.fazenda_id = e.fazenda_id
    cross join lateral (
      select
        lower(nullif(coalesce(
          es.payload #>> '{sanitary_completion,family_code}',
          es.payload->>'family_code',
          es.payload #>> '{regime_sanitario,family_code}'
        ), '')) as family_code,
        regexp_replace(lower(nullif(coalesce(
          es.payload #>> '{sanitary_completion,milestone_code}',
          es.payload->>'milestone_code',
          es.payload #>> '{regime_sanitario,milestone_code}',
          es.payload #>> '{sanitary_completion,official_item_code}',
          es.payload->>'official_item_code',
          es.payload->>'item_code'
        ), '')), '-', '_', 'g') as raw_milestone_code
    ) hraw
    cross join lateral (
      select
        hraw.family_code,
        case
          when hraw.family_code = 'raiva_herbivoros'
           and hraw.raw_milestone_code = 'raiva_reforco_30d'
          then 'raiva_d2'
          else hraw.raw_milestone_code
        end as milestone_code
    ) hnorm
    where e.fazenda_id = _fazenda_id
      and (_animal_id is null or e.animal_id = _animal_id)
      and e.animal_id is not null
      and e.dominio = 'sanitario'
      and e.deleted_at is null
      and es.deleted_at is null
      and hnorm.family_code = 'raiva_herbivoros'
      and hnorm.milestone_code in ('raiva_d1', 'raiva_d2', 'raiva_anual')
  ),
  candidates as (
    select
      a.fazenda_id,
      a.id as animal_id,
      a.especie as animal_especie,
      a.sexo,
      a.data_nascimento,
      ps.id as protocolo_id,
      psi.id as protocol_item_version_id,
      psi.id as protocol_item_version_ref,
      psi.tipo,
      psi.version,
      psi.intervalo_dias,
      psi.payload,
      fsc.zona_raiva_risco,
      fsc.pressao_helmintos,
      fsc.pressao_carrapato,
      rule.family_code,
      rule.calendar_mode,
      rule.is_campaign,
      rule.is_age_window,
      rule.sex_target,
      rule.age_min_days,
      rule.age_max_days,
      rule.has_explicit_agenda_activation,
      rule.has_explicit_species_target,
      rule.species_target_matches,
      rule.rabies_risk_allowed,
      rule.helminth_risk_allowed,
      rule.tick_risk_allowed,
      rule.canonical_milestone_code,
      rule.schedule_kind,
      rule.sequence_order,
      rule.depends_on_milestone_code,
      rule.depends_on_interval_days,
      rule.unknown_history_policy,
      rule.activation_cycle_key,
      rule.activation_date
    from public.animais a
    left join public.fazenda_sanidade_config fsc
      on fsc.fazenda_id = a.fazenda_id
     and fsc.deleted_at is null
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
        nullif(coalesce(
          psi.payload->>'family_code',
          psi.payload #>> '{regime_sanitario,family_code}'
        ), '') as family_code,
        lower(nullif(coalesce(
          psi.payload #>> '{calendario_base,mode}',
          psi.payload->>'calendario_mode',
          psi.payload->>'calendar_mode',
          psi.payload->>'mode'
        ), '')) as calendar_mode,
        coalesce(
          psi.payload #> '{calendario_base,months}',
          psi.payload->'months',
          psi.payload #> '{gatilho_json,months}'
        ) as campaign_months_json,
        upper(nullif(coalesce(
          psi.payload->>'sexo_alvo',
          psi.payload #>> '{gatilho_json,sexo_alvo}',
          psi.payload->>'sex_target',
          psi.payload->>'sexTarget'
        ), '')) as sex_target,
        nullif(coalesce(
          psi.payload->>'idade_min_dias',
          psi.payload #>> '{gatilho_json,age_start_days}',
          psi.payload #>> '{calendario_base,age_start_days}',
          psi.payload->>'age_start_days',
          psi.payload->>'ageStartDays'
        ), '') as age_min_days_raw,
        nullif(coalesce(
          psi.payload->>'idade_max_dias',
          psi.payload #>> '{gatilho_json,age_end_days}',
          psi.payload #>> '{calendario_base,age_end_days}',
          psi.payload->>'age_end_days',
          psi.payload->>'ageEndDays'
        ), '') as age_max_days_raw,
        lower(nullif(coalesce(
          psi.payload #>> '{agenda_activation,explicit}',
          psi.payload #>> '{agenda_activation,requires_explicit_activation}',
          psi.payload #>> '{gatilho_json,requires_explicit_activation}',
          psi.payload->>'requires_explicit_activation',
          psi.payload->>'explicit_activation',
          psi.payload->>'ativacao_operacional_explicita'
        ), '')) as explicit_activation_raw,
        coalesce(
          psi.payload #> '{agenda_activation,risk_values}',
          psi.payload #> '{gatilho_json,risk_values}'
        ) as risk_values_json,
        coalesce(
          psi.payload->'species',
          psi.payload->'especies_alvo',
          psi.payload #> '{gatilho_json,species}'
        ) as species_targets_json,
        regexp_replace(lower(nullif(coalesce(
          psi.payload->>'milestone_code',
          psi.payload #>> '{regime_sanitario,milestone_code}',
          psi.payload->>'item_code',
          psi.payload->>'official_item_code'
        ), '')), '-', '_', 'g') as raw_milestone_code,
        lower(nullif(coalesce(
          psi.payload->>'schedule_kind',
          psi.payload #>> '{regime_sanitario,schedule_kind}',
          psi.payload #>> '{regime_sanitario,schedule_rule,kind}'
        ), '')) as raw_schedule_kind,
        nullif(coalesce(
          psi.payload->>'sequence_order',
          psi.payload #>> '{regime_sanitario,sequence_order}',
          psi.payload->>'dose_num'
        ), '') as sequence_order_raw,
        regexp_replace(lower(nullif(coalesce(
          psi.payload #>> '{depends_on,milestone_code}',
          psi.payload #>> '{regime_sanitario,depends_on_milestone}',
          psi.payload->>'depends_on_item_code'
        ), '')), '-', '_', 'g') as raw_depends_on_milestone_code,
        nullif(coalesce(
          psi.payload #>> '{depends_on,interval_days}',
          psi.payload #>> '{regime_sanitario,schedule_rule,interval_days}',
          psi.payload #>> '{calendario_base,intervalDays}',
          psi.payload #>> '{calendario_base,interval_days}',
          psi.intervalo_dias::text
        ), '') as depends_on_interval_days_raw,
        lower(nullif(psi.payload #>> '{agenda_activation,unknown_history_policy}', '')) as unknown_history_policy,
        coalesce(
          nullif(psi.payload #>> '{agenda_activation,activation_key}', ''),
          nullif(psi.payload #>> '{agenda_activation,cycle_key}', ''),
          nullif(psi.payload #>> '{agenda_activation,activated_on}', ''),
          nullif(psi.payload #>> '{agenda_activation,activated_at}', ''),
          'protocol_item:' || psi.id::text
        ) as activation_cycle_key,
        nullif(coalesce(
          psi.payload #>> '{agenda_activation,activated_on}',
          psi.payload #>> '{agenda_activation,activated_at}'
        ), '') as activation_date_raw
    ) raw
    cross join lateral (
      select
        case
          when raw.family_code = 'raiva_herbivoros'
           and raw.raw_milestone_code = 'raiva_reforco_30d'
          then 'raiva_d2'
          else raw.raw_milestone_code
        end as canonical_milestone_code
    ) milestone
    cross join lateral (
      select
        raw.family_code,
        raw.calendar_mode,
        coalesce(raw.calendar_mode, '') in ('campaign', 'campanha') as is_campaign,
        coalesce(raw.calendar_mode, '') in ('age_window', 'janela_etaria') as is_age_window,
        raw.sex_target,
        case
          when raw.age_min_days_raw ~ '^[0-9]+$' then raw.age_min_days_raw::integer
          else null
        end as age_min_days,
        case
          when raw.age_max_days_raw ~ '^[0-9]+$' then raw.age_max_days_raw::integer
          else null
        end as age_max_days,
        coalesce(raw.explicit_activation_raw, '') in ('true', '1', 'sim', 'yes') as has_explicit_agenda_activation,
        raw.species_targets_json is not null as has_explicit_species_target,
        case
          when a.especie is null then true
          when raw.species_targets_json is null then false
          when jsonb_typeof(raw.species_targets_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.species_targets_json) as st(raw_value)
            cross join regexp_split_to_table(lower(st.raw_value), '[^a-z_]+') as token(value)
            where (
              a.especie = 'bovino'
              and token.value in ('bovino', 'bovinos', 'bovina', 'bovinas')
            )
            or (
              a.especie = 'bubalino'
              and token.value in ('bubalino', 'bubalinos', 'bufalino', 'bufalinos')
            )
            or token.value in ('herbivoro', 'herbivoros', 'ruminante', 'ruminantes')
          )
          when jsonb_typeof(raw.species_targets_json) = 'string' then exists (
            select 1
            from regexp_split_to_table(lower(raw.species_targets_json #>> '{}'), '[^a-z_]+') as token(value)
            where (
              a.especie = 'bovino'
              and token.value in ('bovino', 'bovinos', 'bovina', 'bovinas')
            )
            or (
              a.especie = 'bubalino'
              and token.value in ('bubalino', 'bubalinos', 'bufalino', 'bufalinos')
            )
            or token.value in ('herbivoro', 'herbivoros', 'ruminante', 'ruminantes')
          )
          else false
        end as species_target_matches,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where lower(rv.value) = fsc.zona_raiva_risco
          )
          else false
        end as rabies_risk_allowed,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where rv.value = fsc.pressao_helmintos
          )
          else false
        end as helminth_risk_allowed,
        case
          when jsonb_typeof(raw.risk_values_json) = 'array' then exists (
            select 1
            from jsonb_array_elements_text(raw.risk_values_json) as rv(value)
            where rv.value = fsc.pressao_carrapato
          )
          else false
        end as tick_risk_allowed,
        milestone.canonical_milestone_code,
        coalesce(
          raw.raw_schedule_kind,
          case milestone.canonical_milestone_code
            when 'raiva_d1' then 'calendar_base'
            when 'raiva_d2' then 'after_previous_completion'
            when 'raiva_anual' then 'rolling_from_last_completion'
          end
        ) as schedule_kind,
        coalesce(
          case when raw.sequence_order_raw ~ '^[0-9]+$' then raw.sequence_order_raw::integer end,
          case milestone.canonical_milestone_code
            when 'raiva_d1' then 1
            when 'raiva_d2' then 2
            when 'raiva_anual' then 3
          end
        ) as sequence_order,
        case
          when raw.family_code = 'raiva_herbivoros'
           and raw.raw_depends_on_milestone_code = 'raiva_reforco_30d'
          then 'raiva_d2'
          else coalesce(
            raw.raw_depends_on_milestone_code,
            case milestone.canonical_milestone_code
              when 'raiva_d2' then 'raiva_d1'
              when 'raiva_anual' then 'raiva_d2'
            end
          )
        end as depends_on_milestone_code,
        coalesce(
          case when raw.depends_on_interval_days_raw ~ '^[0-9]+$' then raw.depends_on_interval_days_raw::integer end,
          case milestone.canonical_milestone_code
            when 'raiva_d2' then 30
            when 'raiva_anual' then 365
          end
        ) as depends_on_interval_days,
        raw.unknown_history_policy,
        raw.activation_cycle_key,
        case
          when raw.activation_date_raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          then left(raw.activation_date_raw, 10)::date
        end as activation_date
    ) rule
    where a.fazenda_id = _fazenda_id
      and a.deleted_at is null
      and a.status = 'ativo'
      and (_animal_id is null or a.id = _animal_id)
  ),
  sequence_anchors as (
    select
      c.*,
      d1.completed_on as d1_completed_on,
      d2.completed_on as d2_completed_on,
      annual.completed_on as last_annual_completed_on,
      case
        when annual.completed_on is not null then 'raiva_anual'
        when d2.completed_on is not null then 'raiva_d2'
      end as annual_anchor_milestone,
      coalesce(annual.completed_on, d2.completed_on) as annual_anchor_completed_on
    from candidates c
    left join lateral (
      select max(h.completed_on) as completed_on
      from sanitary_history h
      where h.fazenda_id = c.fazenda_id
        and h.animal_id = c.animal_id
        and h.family_code = 'raiva_herbivoros'
        and h.milestone_code = 'raiva_d1'
    ) d1 on true
    left join lateral (
      select max(h.completed_on) as completed_on
      from sanitary_history h
      where h.fazenda_id = c.fazenda_id
        and h.animal_id = c.animal_id
        and h.family_code = 'raiva_herbivoros'
        and h.milestone_code = 'raiva_d2'
    ) d2 on true
    left join lateral (
      select max(h.completed_on) as completed_on
      from sanitary_history h
      where h.fazenda_id = c.fazenda_id
        and h.animal_id = c.animal_id
        and h.family_code = 'raiva_herbivoros'
        and h.milestone_code = 'raiva_anual'
    ) annual on true
  ),
  scheduled as (
    select
      s.*,
      case
        when s.is_campaign
         and jsonb_typeof(s.payload #> '{calendario_base,months}') = 'array'
        then (
          select _as_of
          from (
            select distinct month_value
            from jsonb_array_elements_text(s.payload #> '{calendario_base,months}') as month_entry(raw_value)
            cross join lateral (
              select case
                when month_entry.raw_value ~ '^[0-9]+$'
                 and month_entry.raw_value::integer between 1 and 12
                then month_entry.raw_value::integer
              end as month_value
            ) parsed
            where month_value is not null
          ) months
          where months.month_value = extract(month from _as_of)::integer
          limit 1
        )
      end as campaign_due_on
    from sequence_anchors s
  ),
  eligible as (
    select
      *,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d1'
        then greatest(_as_of, coalesce(activation_date, _as_of))
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d2'
        then greatest(_as_of, d1_completed_on + depends_on_interval_days)
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_anual'
        then greatest(_as_of, annual_anchor_completed_on + depends_on_interval_days)
        when is_age_window then _as_of
        when is_campaign then coalesce(campaign_due_on, _as_of)
        else greatest(_as_of, coalesce(data_nascimento, _as_of) + intervalo_dias)
      end as due_date,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d1'
        then activation_cycle_key
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d2'
        then (d1_completed_on + depends_on_interval_days)::text
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_anual'
        then (annual_anchor_completed_on + depends_on_interval_days)::text
        when is_age_window and age_min_days is not null then (data_nascimento + age_min_days)::text
        when is_campaign then to_char(coalesce(campaign_due_on, _as_of), 'YYYY-MM')
        else greatest(_as_of, coalesce(data_nascimento, _as_of) + intervalo_dias)::text
      end as dedup_period_key,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d1'
        then 'event'
        when family_code = 'raiva_herbivoros' and canonical_milestone_code in ('raiva_d2', 'raiva_anual')
        then 'interval'
        else public.sanitario_dedup_period_mode(calendar_mode)
      end as dedup_period_mode,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d2'
        then 'raiva_d1'
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_anual'
        then annual_anchor_milestone
      end as sequence_anchor_milestone,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d2'
        then d1_completed_on
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_anual'
        then annual_anchor_completed_on
      end as sequence_anchor_completed_on,
      case
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d1'
        then greatest(_as_of, coalesce(activation_date, _as_of))
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_d2'
        then d1_completed_on + depends_on_interval_days
        when family_code = 'raiva_herbivoros' and canonical_milestone_code = 'raiva_anual'
        then annual_anchor_completed_on + depends_on_interval_days
      end as sequence_due_on
    from scheduled
    where (
        sex_target is null
        or sex_target in ('TODOS', 'ALL', 'AMBOS')
        or (
          sex_target in ('F', 'FEMEA', 'FEMININO', 'FEMALE')
          and sexo = 'F'::public.sexo_enum
        )
        or (
          sex_target in ('M', 'MACHO', 'MASCULINO', 'MALE')
          and sexo = 'M'::public.sexo_enum
        )
      )
      and (
        age_min_days is null and age_max_days is null
        or (
          data_nascimento is not null
          and (age_min_days is null or (_as_of - data_nascimento) >= age_min_days)
          and (age_max_days is null or (_as_of - data_nascimento) <= age_max_days)
        )
      )
      and (
        animal_especie is null
        or coalesce(family_code, '') not in (
          'brucelose',
          'raiva_herbivoros',
          'clostridioses',
          'leptospirose_ibr_bvd',
          'controle_parasitario',
          'controle_estrategico_parasitas',
          'controle_carrapato'
        )
        or (
          coalesce(family_code, '') in ('brucelose', 'raiva_herbivoros')
          and animal_especie in ('bovino', 'bubalino')
        )
        or (
          coalesce(family_code, '') in (
            'clostridioses',
            'leptospirose_ibr_bvd',
            'controle_parasitario',
            'controle_estrategico_parasitas',
            'controle_carrapato'
          )
          and (
            (not has_explicit_species_target and animal_especie in ('bovino', 'bubalino'))
            or (has_explicit_species_target and species_target_matches)
          )
        )
      )
      and (
        not is_campaign
        or campaign_due_on is not null
      )
      and (
        coalesce(family_code, '') not in (
          'terapia_vaca_seca',
          'tristeza_parasitaria_bovina',
          'cura_umbigo'
        )
      )
      and (
        coalesce(family_code, '') <> 'raiva_herbivoros'
        or (
          zona_raiva_risco is not null
          and zona_raiva_risco in ('medio', 'alto')
          and has_explicit_agenda_activation
          and rabies_risk_allowed
          and canonical_milestone_code in ('raiva_d1', 'raiva_d2', 'raiva_anual')
          and (
            (
              canonical_milestone_code = 'raiva_d1'
              and unknown_history_policy = 'start_from_d1'
              and d1_completed_on is null
            )
            or (
              canonical_milestone_code = 'raiva_d2'
              and depends_on_milestone_code = 'raiva_d1'
              and d1_completed_on is not null
              and d2_completed_on is null
            )
            or (
              canonical_milestone_code = 'raiva_anual'
              and depends_on_milestone_code = 'raiva_d2'
              and d2_completed_on is not null
              and annual_anchor_completed_on is not null
            )
          )
        )
      )
      and (
        coalesce(family_code, '') not in (
          'clostridioses',
          'leptospirose_ibr_bvd',
          'controle_parasitario',
          'controle_estrategico_parasitas',
          'controle_carrapato'
        )
        or has_explicit_agenda_activation
      )
      and (
        coalesce(family_code, '') not in ('controle_parasitario', 'controle_estrategico_parasitas')
        or (
          pressao_helmintos is not null
          and helminth_risk_allowed
        )
      )
      and (
        coalesce(family_code, '') <> 'controle_carrapato'
        or (
          pressao_carrapato is not null
          and tick_risk_allowed
        )
      )
  ),
  planned as (
    select
      *,
      public.render_sanitario_canonical_dedup_key(
        'animal',
        animal_id,
        coalesce(family_code, protocolo_id::text),
        coalesce(
          case when family_code = 'raiva_herbivoros' then canonical_milestone_code end,
          payload->>'official_item_code',
          payload->>'item_code',
          protocol_item_version_ref::text
        ),
        version,
        dedup_period_mode,
        dedup_period_key,
        null
      ) as candidate_dedup_key,
      case
        when family_code = 'raiva_herbivoros' then
          payload ||
          jsonb_strip_nulls(jsonb_build_object(
            'family_code', 'raiva_herbivoros',
            'item_code', canonical_milestone_code,
            'official_item_code', canonical_milestone_code,
            'milestone_code', canonical_milestone_code,
            'sequence_order', sequence_order,
            'schedule_kind', schedule_kind,
            'sequence_anchor_milestone', sequence_anchor_milestone,
            'sequence_anchor_completed_on', sequence_anchor_completed_on,
            'sequence_due_on', sequence_due_on
          ))
        else payload
      end as planned_payload,
      case
        when family_code = 'raiva_herbivoros' then coalesce(depends_on_interval_days, intervalo_dias)
        else intervalo_dias
      end as planned_interval_days
    from eligible
  )
  insert into public.agenda_itens (
    fazenda_id, dominio, tipo, status, data_prevista, animal_id, dedup_key,
    source_kind, source_ref, protocol_item_version_id, interval_days_applied,
    payload, client_id, client_recorded_at, server_received_at
  )
  select
    fazenda_id,
    'sanitario'::public.dominio_enum,
    tipo::text,
    'agendado'::public.agenda_status_enum,
    due_date,
    animal_id,
    candidate_dedup_key,
    'automatico'::public.agenda_source_kind_enum,
    jsonb_build_object('protocolo_id', protocolo_id, 'protocol_item_version_id', protocol_item_version_id),
    protocol_item_version_id,
    planned_interval_days,
    planned_payload,
    'server',
    now(),
    now()
  from planned p
  where not exists (
    select 1
    from public.agenda_itens ai
    where ai.fazenda_id = p.fazenda_id
      and ai.dedup_key = p.candidate_dedup_key
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
    join public.eventos_sanitario es
      on es.evento_id = e.id
     and es.fazenda_id = e.fazenda_id
    where e.fazenda_id = p.fazenda_id
      and e.animal_id = p.animal_id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
      and es.deleted_at is null
      and es.payload #>> '{sanitary_completion,sanitary_completion_key}' = p.candidate_dedup_key
  )
  on conflict (fazenda_id, dedup_key)
  where status = 'agendado' and deleted_at is null and dedup_key is not null
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
