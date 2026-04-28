-- 20260412173000_sanitario_regime_sequencial_e_historico_entrada.sql
-- Endurece o motor sanitario com contrato explicito de regime/milestone,
-- deduplicacao semantica por familia protocolar e regra de catch-up para
-- animais adquiridos sem historico confirmado.

create or replace function public.render_sanitario_canonical_dedup_key(
  _scope_type text,
  _scope_id uuid,
  _family_code text,
  _item_code text,
  _regimen_version int,
  _period_mode text,
  _period_key text,
  _jurisdiction text default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
begin
  if nullif(_scope_type, '') is null
    or _scope_id is null
    or nullif(_family_code, '') is null
    or nullif(_item_code, '') is null
    or coalesce(_regimen_version, 0) < 1
    or nullif(_period_mode, '') is null
    or nullif(_period_key, '') is null then
    return null;
  end if;

  v_key := concat_ws(
    ':',
    'sanitario',
    lower(trim(_scope_type)),
    _scope_id::text,
    lower(trim(_family_code)),
    lower(trim(_item_code)),
    format('v%s', coalesce(_regimen_version, 1)),
    lower(trim(_period_mode)),
    trim(_period_key)
  );

  if nullif(_jurisdiction, '') is not null then
    v_key := concat(v_key, ':', upper(trim(_jurisdiction)));
  end if;

  return v_key;
end;
$$;

comment on function public.render_sanitario_canonical_dedup_key(text, uuid, text, text, int, text, text, text)
  is 'Gera dedup_key canonica da agenda sanitaria no mesmo contrato estruturado do TypeScript.';

create or replace function public.sanitario_dedup_period_mode(
  _calendar_mode text,
  _schedule_kind text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(nullif(_calendar_mode, ''), 'legacy'))
    when 'campaign' then 'campaign'
    when 'age_window' then 'window'
    when 'rolling_interval' then 'interval'
    when 'immediate' then 'event'
    when 'clinical_protocol' then 'unstructured'
    else
      case lower(coalesce(nullif(_schedule_kind, ''), 'calendar_base'))
        when 'after_previous_completion' then 'interval'
        when 'rolling_from_last_completion' then 'interval'
        else 'unstructured'
      end
    end;
$$;

comment on function public.sanitario_dedup_period_mode(text, text)
  is 'Normaliza modo de calendario/regime para periodMode canonico usado em dedup sanitario.';

create or replace function public.sanitario_recompute_agenda_core(
  _fazenda_id uuid default null,
  _animal_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_rows integer := 0;
  v_ref_date date := coalesce(_as_of, current_date);
begin
  with fazendas_base as (
    select
      f.id as fazenda_id,
      f.metadata
    from public.fazendas f
    where f.deleted_at is null
      and (_fazenda_id is null or f.id = _fazenda_id)
  ),
  animais_alvo as (
    select
      a.id,
      a.fazenda_id,
      a.lote_id,
      a.data_nascimento,
      a.data_entrada,
      a.origem,
      a.sexo,
      a.status,
      a.payload,
      fb.metadata as fazenda_metadata
    from public.animais a
    join fazendas_base fb
      on fb.fazenda_id = a.fazenda_id
    where a.deleted_at is null
      and a.status = 'ativo'
      and (_animal_id is null or a.id = _animal_id)
  ),
  protocolos_base as (
    select
      p.id,
      p.fazenda_id,
      p.nome,
      p.payload,
      public.sanitario_safe_date(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'valido_de')
      ) as valido_de_eff,
      public.sanitario_safe_date(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'valido_ate')
      ) as valido_ate_eff,
      lower(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'especie')
      ) as especie_eff,
      lower(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'categoria_produtiva')
      ) as categoria_eff,
      upper(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'sexo_alvo')
      ) as sexo_alvo_eff,
      case
        when jsonb_typeof(p.payload -> 'sexos_alvo') = 'array' then p.payload -> 'sexos_alvo'
        else null
      end as sexos_alvo_eff,
      public.sanitario_safe_int(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'idade_minima_dias')
      ) as idade_min_dias_eff,
      public.sanitario_safe_int(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'idade_maxima_dias')
      ) as idade_max_dias_eff,
      public.sanitario_safe_bool(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'obrigatorio')
      ) as protocolo_obrigatorio_eff,
      public.sanitario_safe_bool(
        public.sanitario_pick_text(to_jsonb(p), p.payload, 'keep_after_window')
      ) as keep_after_window_eff,
      lower(nullif(p.payload ->> 'status_legal', '')) as status_legal_eff,
      nullif(p.payload ->> 'family_code', '') as family_code_eff,
      coalesce(
        public.sanitario_safe_int(nullif(p.payload ->> 'regimen_version', '')),
        1
      ) as regimen_version_eff
    from public.protocolos_sanitarios p
    where p.deleted_at is null
      and p.ativo = true
      and (_fazenda_id is null or p.fazenda_id = _fazenda_id)
  ),
  itens_base as (
    select
      i.id,
      i.fazenda_id,
      i.protocolo_id,
      i.tipo,
      i.produto,
      i.payload,
      i.dedup_template,
      coalesce(i.dose_num, 1) as dose_num_eff,
      coalesce(
        public.sanitario_safe_int(i.payload #>> '{calendario_base,age_start_days}'),
        public.sanitario_safe_int(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'idade_minima_dias')
        ),
        public.sanitario_safe_int(i.payload #>> '{janela_etaria_meses,min}') * 30
      ) as idade_min_dias_eff,
      coalesce(
        public.sanitario_safe_int(i.payload #>> '{calendario_base,age_end_days}'),
        public.sanitario_safe_int(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'idade_maxima_dias')
        ),
        public.sanitario_safe_int(i.payload #>> '{janela_etaria_meses,max}') * 30
      ) as idade_max_dias_eff,
      coalesce(
        public.sanitario_safe_int(i.payload #>> '{calendario_base,interval_days}'),
        public.sanitario_safe_int(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'intervalo_dias')
        ),
        i.intervalo_dias
      ) as intervalo_dias_eff,
      coalesce(
        public.sanitario_safe_bool(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'ativo')
        ),
        true
      ) as item_ativo_eff,
      upper(
        public.sanitario_pick_text(to_jsonb(i), i.payload, 'sexo_alvo')
      ) as sexo_alvo_eff,
      case
        when jsonb_typeof(i.payload -> 'sexos_alvo') = 'array' then i.payload -> 'sexos_alvo'
        else null
      end as sexos_alvo_eff,
      nullif(i.payload ->> 'depends_on_item_code', '') as depends_on_item_code_eff,
      nullif(i.payload ->> 'item_code', '') as item_code_eff,
      nullif(i.payload #>> '{calendario_base,mode}', '') as calendar_mode_eff,
      nullif(i.payload #>> '{calendario_base,anchor}', '') as calendar_anchor_eff,
      case
        when jsonb_typeof(i.payload #> '{calendario_base,months}') = 'array'
          then i.payload #> '{calendario_base,months}'
        else null
      end as calendar_months_eff,
      public.sanitario_safe_bool(
        public.sanitario_pick_text(to_jsonb(i), i.payload, 'obrigatorio')
      ) as item_obrigatorio_eff,
      public.sanitario_safe_bool(
        public.sanitario_pick_text(to_jsonb(i), i.payload, 'keep_after_window')
      ) as keep_after_window_eff,
      coalesce(
        nullif(i.payload #>> '{regime_sanitario,family_code}', ''),
        nullif(i.payload ->> 'family_code', '')
      ) as family_code_eff,
      coalesce(
        public.sanitario_safe_int(nullif(i.payload #>> '{regime_sanitario,regimen_version}', '')),
        public.sanitario_safe_int(nullif(i.payload ->> 'regimen_version', '')),
        1
      ) as regimen_version_eff,
      coalesce(
        nullif(i.payload #>> '{regime_sanitario,milestone_code}', ''),
        nullif(i.payload ->> 'item_code', ''),
        format('dose_%s', coalesce(i.dose_num, 1))
      ) as milestone_code_eff,
      coalesce(
        public.sanitario_safe_int(nullif(i.payload #>> '{regime_sanitario,sequence_order}', '')),
        coalesce(i.dose_num, 1)
      ) as sequence_order_eff,
      coalesce(
        nullif(i.payload #>> '{regime_sanitario,depends_on_milestone}', ''),
        nullif(i.payload ->> 'depends_on_item_code', '')
      ) as depends_on_milestone_eff,
      coalesce(
        nullif(i.payload #>> '{regime_sanitario,schedule_rule,kind}', ''),
        case
          when coalesce(i.dose_num, 1) > 1 then 'after_previous_completion'
          else null
        end
      ) as schedule_kind_eff,
      coalesce(
        nullif(i.payload #>> '{regime_sanitario,completion_rule,type}', ''),
        'event'
      ) as completion_type_eff,
      coalesce(
        public.sanitario_safe_bool(
          nullif(i.payload #>> '{regime_sanitario,completion_rule,requires_documentation}', '')
        ),
        public.sanitario_safe_bool(
          public.sanitario_pick_text(
            to_jsonb(i),
            i.payload,
            'requires_compliance_document'
          )
        ),
        false
      ) as requires_documentation_eff
    from public.protocolos_sanitarios_itens i
    where i.deleted_at is null
      and i.gera_agenda = true
      and (_fazenda_id is null or i.fazenda_id = _fazenda_id)
  ),
  matriz_base as (
    select
      a.id as animal_id,
      a.fazenda_id,
      a.lote_id,
      a.data_nascimento,
      a.data_entrada,
      a.origem,
      a.sexo,
      a.payload as animal_payload,
      a.fazenda_metadata,
      p.id as protocolo_id,
      p.nome as protocolo_nome,
      p.payload as protocolo_payload,
      i.payload as item_payload,
      p.valido_de_eff,
      p.valido_ate_eff,
      p.especie_eff,
      p.categoria_eff,
      p.sexo_alvo_eff,
      p.sexos_alvo_eff,
      p.status_legal_eff,
      p.family_code_eff as protocolo_family_code_eff,
      p.regimen_version_eff as protocolo_regimen_version_eff,
      i.id as protocolo_item_id,
      i.tipo as item_tipo,
      i.produto as item_produto,
      i.dose_num_eff,
      i.sequence_order_eff,
      i.intervalo_dias_eff,
      coalesce(i.idade_min_dias_eff, p.idade_min_dias_eff) as idade_min_dias_eff,
      coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff) as idade_max_dias_eff,
      i.dedup_template,
      i.depends_on_item_code_eff,
      i.depends_on_milestone_eff,
      i.item_code_eff,
      i.milestone_code_eff,
      coalesce(i.family_code_eff, p.family_code_eff) as family_code_eff,
      coalesce(i.regimen_version_eff, p.regimen_version_eff, 1) as regimen_version_eff,
      i.schedule_kind_eff,
      i.completion_type_eff,
      i.requires_documentation_eff,
      i.sexo_alvo_eff as item_sexo_alvo_eff,
      i.sexos_alvo_eff as item_sexos_alvo_eff,
      i.calendar_mode_eff,
      i.calendar_anchor_eff,
      i.calendar_months_eff,
      (
        coalesce(i.keep_after_window_eff, false)
        or coalesce(p.keep_after_window_eff, false)
        or coalesce(i.item_obrigatorio_eff, false)
        or coalesce(p.protocolo_obrigatorio_eff, false)
        or p.status_legal_eff = 'obrigatorio'
      ) as keep_after_window_eff,
      public.sanitario_resolve_anchor_date(
        i.calendar_anchor_eff,
        a.data_nascimento,
        a.payload,
        a.fazenda_metadata
      ) as anchor_date_eff,
      case
        when a.data_nascimento is null
          or coalesce(i.idade_min_dias_eff, p.idade_min_dias_eff) is null then null::date
        else a.data_nascimento + coalesce(i.idade_min_dias_eff, p.idade_min_dias_eff)
      end as eligibility_start_date_eff,
      case
        when a.data_nascimento is null
          or coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff) is null then null::date
        else a.data_nascimento + coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff)
      end as eligibility_end_date_eff
    from animais_alvo a
    join protocolos_base p
      on p.fazenda_id = a.fazenda_id
    join itens_base i
      on i.fazenda_id = a.fazenda_id
      and i.protocolo_id = p.id
      and i.item_ativo_eff = true
    where (p.valido_de_eff is null or v_ref_date >= p.valido_de_eff)
      and (p.valido_ate_eff is null or v_ref_date <= p.valido_ate_eff)
      and (p.sexo_alvo_eff is null or p.sexo_alvo_eff = upper(a.sexo::text))
      and (i.sexo_alvo_eff is null or i.sexo_alvo_eff = upper(a.sexo::text))
      and (
        p.sexos_alvo_eff is null
        or public.sanitario_json_array_contains_ci(p.sexos_alvo_eff, a.sexo::text)
      )
      and (
        i.sexos_alvo_eff is null
        or public.sanitario_json_array_contains_ci(i.sexos_alvo_eff, a.sexo::text)
      )
      and (
        p.especie_eff is null
        or p.especie_eff = lower(coalesce(a.payload ->> 'especie', ''))
        or public.sanitario_json_array_contains_ci(
          p.payload -> 'especies',
          a.payload ->> 'especie'
        )
      )
      and (
        p.categoria_eff is null
        or p.categoria_eff = lower(
          coalesce(a.payload ->> 'categoria_produtiva', a.payload ->> 'categoria', '')
        )
        or public.sanitario_json_array_contains_ci(
          p.payload -> 'categorias_produtivas',
          coalesce(a.payload ->> 'categoria_produtiva', a.payload ->> 'categoria')
        )
      )
  ),
  matriz as (
    select
      mb.*,
      case
        when mb.family_code_eff is null then null::date
        else public.sanitario_safe_date(
          nullif(
            mb.animal_payload #>> array['sanitary_regimes', mb.family_code_eff, 'last_valid_completed_at'],
            ''
          )
        )
      end as family_last_valid_completed_eff,
      case
        when mb.family_code_eff is null then null::text
        else nullif(
          mb.animal_payload #>> array['sanitary_regimes', mb.family_code_eff, 'last_completed_milestone'],
          ''
        )
      end as family_last_milestone_eff,
      lower(
        coalesce(
          case
            when mb.family_code_eff is null then null::text
            else nullif(
              mb.animal_payload #>> array['sanitary_regimes', mb.family_code_eff, 'history_confidence'],
              ''
            )
          end,
          nullif(mb.item_payload #>> '{regime_sanitario,history_confidence}', ''),
          case
            when mb.origem is not null and mb.origem <> 'nascimento'::public.origem_enum
              then 'unknown'
            else 'known'
          end
        )
      ) as history_confidence_eff,
      lower(
        coalesce(
          case
            when mb.family_code_eff is null then null::text
            else nullif(
              mb.animal_payload #>> array['sanitary_regimes', mb.family_code_eff, 'compliance_state'],
              ''
            )
          end,
          nullif(mb.item_payload #>> '{regime_sanitario,compliance_state}', ''),
          case
            when mb.requires_documentation_eff then 'documentation_required'
            else 'scheduled'
          end
        )
      ) as compliance_state_eff
    from matriz_base mb
    where mb.keep_after_window_eff = true
      or mb.eligibility_end_date_eff is null
      or v_ref_date <= mb.eligibility_end_date_eff
      or (mb.origem is not null and mb.origem <> 'nascimento'::public.origem_enum)
  ),
  dose_context as (
    select
      m.*,
      exists (
        select 1
        from itens_base nx
        where nx.protocolo_id = m.protocolo_id
          and coalesce(nx.family_code_eff, '') = coalesce(m.family_code_eff, '')
          and nx.sequence_order_eff = m.sequence_order_eff + 1
          and nx.item_ativo_eff = true
      ) as has_next_dose
    from matriz m
  ),
  ultima_aplicacao_item as (
    select
      dc.animal_id,
      dc.protocolo_item_id,
      max(e.occurred_on) as ultima_data_item
    from dose_context dc
    join public.agenda_itens ai
      on ai.fazenda_id = dc.fazenda_id
      and ai.animal_id = dc.animal_id
      and ai.protocol_item_version_id = dc.protocolo_item_id
      and ai.deleted_at is null
    join public.eventos e
      on e.fazenda_id = ai.fazenda_id
      and e.source_task_id = ai.id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
    join public.eventos_sanitario es
      on es.fazenda_id = e.fazenda_id
      and es.evento_id = e.id
      and es.deleted_at is null
    group by dc.animal_id, dc.protocolo_item_id
  ),
  ultima_aplicacao_dose_anterior as (
    select
      dc.animal_id,
      dc.protocolo_item_id,
      max(e.occurred_on) as ultima_data_prev
    from dose_context dc
    join itens_base prev
      on prev.protocolo_id = dc.protocolo_id
      and prev.sequence_order_eff = dc.sequence_order_eff - 1
      and prev.item_ativo_eff = true
    join public.agenda_itens ai_prev
      on ai_prev.fazenda_id = dc.fazenda_id
      and ai_prev.animal_id = dc.animal_id
      and ai_prev.protocol_item_version_id = prev.id
      and ai_prev.deleted_at is null
    join public.eventos e
      on e.fazenda_id = ai_prev.fazenda_id
      and e.source_task_id = ai_prev.id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
    join public.eventos_sanitario es
      on es.fazenda_id = e.fazenda_id
      and es.evento_id = e.id
      and es.deleted_at is null
    group by dc.animal_id, dc.protocolo_item_id
  ),
  ultima_aplicacao_dependencia as (
    select
      dc.animal_id,
      dc.protocolo_item_id,
      max(e.occurred_on) as ultima_data_dep
    from dose_context dc
    join public.agenda_itens ai_dep
      on ai_dep.fazenda_id = dc.fazenda_id
      and ai_dep.animal_id = dc.animal_id
      and ai_dep.deleted_at is null
    join public.protocolos_sanitarios_itens psi_dep
      on psi_dep.id = ai_dep.protocol_item_version_id
      and psi_dep.fazenda_id = ai_dep.fazenda_id
      and psi_dep.deleted_at is null
    join public.eventos e
      on e.fazenda_id = ai_dep.fazenda_id
      and e.source_task_id = ai_dep.id
      and e.dominio = 'sanitario'
      and e.deleted_at is null
    join public.eventos_sanitario es
      on es.fazenda_id = e.fazenda_id
      and es.evento_id = e.id
      and es.deleted_at is null
    where coalesce(
      nullif(psi_dep.payload #>> '{regime_sanitario,milestone_code}', ''),
      nullif(psi_dep.payload ->> 'item_code', '')
    ) = coalesce(dc.depends_on_milestone_eff, dc.depends_on_item_code_eff)
    group by dc.animal_id, dc.protocolo_item_id
  ),
  contexto_execucao as (
    select
      dc.*,
      ui.ultima_data_item,
      uprev.ultima_data_prev,
      udep.ultima_data_dep,
      case
        when dc.anchor_date_eff is null then null::date
        when ui.ultima_data_item is null then dc.anchor_date_eff
        when dc.calendar_anchor_eff in ('weaning', 'dry_off')
          and dc.anchor_date_eff > ui.ultima_data_item then dc.anchor_date_eff
        else null::date
      end as anchor_trigger_due_eff,
      coalesce(
        udep.ultima_data_dep,
        case
          when dc.family_last_milestone_eff = coalesce(dc.depends_on_milestone_eff, dc.depends_on_item_code_eff)
            then dc.family_last_valid_completed_eff
          else null::date
        end
      ) as ultima_data_dep_eff,
      coalesce(
        ui.ultima_data_item,
        case
          when dc.family_last_milestone_eff = dc.milestone_code_eff
            then dc.family_last_valid_completed_eff
          else null::date
        end
      ) as ultima_data_item_eff,
      (
        dc.origem is not null
        and dc.origem <> 'nascimento'::public.origem_enum
        and dc.data_entrada is not null
        and dc.eligibility_end_date_eff is not null
        and dc.data_entrada > dc.eligibility_end_date_eff
      ) as acquired_after_window_eff
    from dose_context dc
    left join ultima_aplicacao_item ui
      on ui.animal_id = dc.animal_id
      and ui.protocolo_item_id = dc.protocolo_item_id
    left join ultima_aplicacao_dose_anterior uprev
      on uprev.animal_id = dc.animal_id
      and uprev.protocolo_item_id = dc.protocolo_item_id
    left join ultima_aplicacao_dependencia udep
      on udep.animal_id = dc.animal_id
      and udep.protocolo_item_id = dc.protocolo_item_id
  ),
  candidatos as (
    select
      ce.fazenda_id,
      ce.animal_id,
      ce.lote_id,
      ce.protocolo_id,
      ce.protocolo_nome,
      ce.protocolo_item_id,
      ce.item_tipo,
      ce.item_produto,
      ce.dose_num_eff,
      ce.sequence_order_eff,
      ce.intervalo_dias_eff,
      ce.idade_min_dias_eff,
      ce.calendar_mode_eff,
      ce.calendar_anchor_eff,
      ce.schedule_kind_eff,
      ce.eligibility_start_date_eff,
      ce.family_code_eff,
      ce.regimen_version_eff,
      ce.item_code_eff,
      ce.milestone_code_eff,
      ce.history_confidence_eff,
      case
        when ce.acquired_after_window_eff then
          case
            when ce.requires_documentation_eff then 'documentation_required'
            else 'catch_up_required'
          end
        else ce.compliance_state_eff
      end as compliance_state_eff,
      case
        when ce.schedule_kind_eff = 'after_previous_completion'
          or (
            ce.sequence_order_eff > 1
            and coalesce(ce.depends_on_milestone_eff, ce.depends_on_item_code_eff) is not null
          ) then
          case
            when ce.intervalo_dias_eff is null then null::date
            when ce.ultima_data_dep_eff is null then null::date
            when ce.ultima_data_item_eff is not null
              and ce.ultima_data_item_eff >= ce.ultima_data_dep_eff then null::date
            else ce.ultima_data_dep_eff + ce.intervalo_dias_eff
          end
        when ce.schedule_kind_eff = 'rolling_from_last_completion' then
          case
            when ce.intervalo_dias_eff is null then null::date
            when ce.ultima_data_item_eff is not null then
              greatest(
                ce.ultima_data_item_eff + ce.intervalo_dias_eff,
                coalesce(
                  ce.anchor_trigger_due_eff,
                  ce.ultima_data_item_eff + ce.intervalo_dias_eff
                )
              )
            when ce.ultima_data_dep_eff is not null then
              ce.ultima_data_dep_eff + ce.intervalo_dias_eff
            when ce.acquired_after_window_eff then
              greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
            else
              coalesce(
                ce.anchor_trigger_due_eff,
                ce.eligibility_start_date_eff,
                ce.anchor_date_eff,
                v_ref_date
              )
          end
        else
          case coalesce(ce.calendar_mode_eff, 'legacy')
            when 'campaign' then
              case
                when ce.calendar_months_eff is not null then
                  public.sanitario_resolve_campaign_due_date(
                    ce.calendar_months_eff,
                    v_ref_date,
                    ce.eligibility_start_date_eff,
                    ce.ultima_data_item_eff
                  )
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item_eff is not null then
                  ce.ultima_data_item_eff + ce.intervalo_dias_eff
                when ce.acquired_after_window_eff then
                  greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
                else
                  coalesce(
                    ce.anchor_trigger_due_eff,
                    ce.eligibility_start_date_eff,
                    ce.anchor_date_eff,
                    v_ref_date
                  )
              end
            when 'rolling_interval' then
              case
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item_eff is not null then
                  greatest(
                    ce.ultima_data_item_eff + ce.intervalo_dias_eff,
                    coalesce(
                      ce.anchor_trigger_due_eff,
                      ce.ultima_data_item_eff + ce.intervalo_dias_eff
                    )
                  )
                when ce.acquired_after_window_eff then
                  greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
                else
                  coalesce(
                    ce.anchor_trigger_due_eff,
                    ce.eligibility_start_date_eff,
                    ce.anchor_date_eff,
                    v_ref_date
                  )
              end
            when 'age_window' then
              case
                when ce.calendar_anchor_eff in ('weaning', 'dry_off') then
                  coalesce(
                    ce.anchor_trigger_due_eff,
                    case
                      when ce.ultima_data_item_eff is null then ce.anchor_date_eff
                      else null::date
                    end
                  )
                when ce.ultima_data_item_eff is not null then
                  null::date
                when ce.acquired_after_window_eff then
                  greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
                else
                  coalesce(
                    ce.eligibility_start_date_eff,
                    ce.anchor_trigger_due_eff,
                    ce.anchor_date_eff
                  )
              end
            when 'immediate' then
              case
                when ce.calendar_anchor_eff = 'clinical_need' then null::date
                else
                  coalesce(
                    ce.anchor_trigger_due_eff,
                    case
                      when ce.ultima_data_item_eff is null then ce.anchor_date_eff
                      else null::date
                    end,
                    case
                      when ce.ultima_data_item_eff is null then ce.eligibility_start_date_eff
                      else null::date
                    end
                  )
              end
            when 'clinical_protocol' then
              case
                when ce.calendar_anchor_eff = 'clinical_need' then null::date
                else
                  coalesce(
                    ce.anchor_trigger_due_eff,
                    case
                      when ce.ultima_data_item_eff is null then ce.anchor_date_eff
                      else null::date
                    end
                  )
              end
            else
              case
                when coalesce(ce.depends_on_milestone_eff, ce.depends_on_item_code_eff) is not null then
                  case
                    when ce.intervalo_dias_eff is null then null::date
                    when ce.ultima_data_dep_eff is null then null::date
                    when ce.ultima_data_item_eff is not null then ce.ultima_data_item_eff + ce.intervalo_dias_eff
                    else ce.ultima_data_dep_eff + ce.intervalo_dias_eff
                  end
                when ce.has_next_dose then
                  case
                    when ce.ultima_data_item_eff is not null then null::date
                    when ce.acquired_after_window_eff then
                      greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
                    when ce.data_nascimento is null then null::date
                    else ce.data_nascimento + coalesce(ce.idade_min_dias_eff, 0)
                  end
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item_eff is not null then
                  ce.ultima_data_item_eff + ce.intervalo_dias_eff
                when ce.acquired_after_window_eff then
                  greatest(coalesce(ce.data_entrada, v_ref_date), v_ref_date)
                when ce.data_nascimento is null then
                  null::date
                else
                  ce.data_nascimento + coalesce(ce.idade_min_dias_eff, 0)
              end
          end
      end as data_prevista_calc
    from contexto_execucao ce
  ),
  candidatos_validos as (
    select
      c.*,
      public.render_sanitario_canonical_dedup_key(
        'animal',
        c.animal_id,
        c.family_code_eff,
        coalesce(c.item_code_eff, c.milestone_code_eff, format('dose_%s', c.dose_num_eff)),
        c.regimen_version_eff,
        public.sanitario_dedup_period_mode(c.calendar_mode_eff, c.schedule_kind_eff),
        case public.sanitario_dedup_period_mode(c.calendar_mode_eff, c.schedule_kind_eff)
          when 'campaign' then to_char(c.data_prevista_calc, 'YYYY-MM')
          when 'window' then coalesce(c.eligibility_start_date_eff, c.data_prevista_calc)::text
          else c.data_prevista_calc::text
        end,
        null
      ) as dedup_key
    from candidatos c
    where c.data_prevista_calc is not null
  ),
  upserted as (
    insert into public.agenda_itens as ai (
      id,
      fazenda_id,
      dominio,
      tipo,
      status,
      data_prevista,
      animal_id,
      lote_id,
      dedup_key,
      source_kind,
      source_ref,
      source_evento_id,
      protocol_item_version_id,
      interval_days_applied,
      payload,
      client_id,
      client_op_id,
      client_tx_id,
      client_recorded_at
    )
    select
      gen_random_uuid(),
      cv.fazenda_id,
      'sanitario'::public.dominio_enum,
      cv.item_tipo::text,
      'agendado'::public.agenda_status_enum,
      cv.data_prevista_calc,
      cv.animal_id,
      cv.lote_id,
      cv.dedup_key,
      'automatico'::public.agenda_source_kind_enum,
      jsonb_build_object(
        'protocolo_id', cv.protocolo_id,
        'protocolo_item_id', cv.protocolo_item_id,
        'dose_num', cv.dose_num_eff,
        'sequence_order', cv.sequence_order_eff,
        'tipo', cv.item_tipo::text,
        'produto', cv.item_produto,
        'calendar_mode', cv.calendar_mode_eff,
        'calendar_anchor', cv.calendar_anchor_eff,
        'family_code', cv.family_code_eff,
        'regimen_version', cv.regimen_version_eff,
        'milestone_code', cv.milestone_code_eff,
        'history_confidence', cv.history_confidence_eff,
        'compliance_state', cv.compliance_state_eff,
        'engine', 'sanitario_recompute_v3'
      ),
      null,
      cv.protocolo_item_id,
      cv.intervalo_dias_eff,
      jsonb_build_object(
        'protocolo_nome', cv.protocolo_nome,
        'produto', cv.item_produto,
        'calendar_mode', cv.calendar_mode_eff,
        'calendar_anchor', cv.calendar_anchor_eff,
        'family_code', cv.family_code_eff,
        'regimen_version', cv.regimen_version_eff,
        'milestone_code', cv.milestone_code_eff,
        'history_confidence', cv.history_confidence_eff,
        'compliance_state', cv.compliance_state_eff
      ),
      'server:sanitario-motor',
      gen_random_uuid(),
      null,
      now()
    from candidatos_validos cv
    on conflict (fazenda_id, dedup_key)
      where (
        status = 'agendado'::public.agenda_status_enum
        and deleted_at is null
        and dedup_key is not null
      )
    do update
      set data_prevista = excluded.data_prevista,
          animal_id = excluded.animal_id,
          lote_id = excluded.lote_id,
          tipo = excluded.tipo,
          source_ref = excluded.source_ref,
          protocol_item_version_id = excluded.protocol_item_version_id,
          interval_days_applied = excluded.interval_days_applied,
          payload = coalesce(ai.payload, '{}'::jsonb) || excluded.payload
    returning 1
  )
  select count(*) into v_rows from upserted;

  return coalesce(v_rows, 0);
end;
$$;

comment on function public.sanitario_recompute_agenda_core(uuid, uuid, date)
  is 'Motor declarativo de agenda sanitaria com regime sequencial por familia, dedup semantica e regra de catch-up para historico de entrada.';
