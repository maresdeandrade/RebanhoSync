-- 20260411103000_sanitario_calendario_base_declarative_engine.sql
-- Conecta payload.calendario_base ao motor declarativo da agenda sanitaria.
-- Principais efeitos:
-- 1) suporte a campanha, janela etaria, intervalo recorrente e ancoras operacionais
-- 2) remocao da restricao antiga que gerava agenda apenas para vacinacao
-- 3) limpeza/reconstrucao de pendencias automaticas no recompute para evitar drift

create or replace function public.sanitario_resolve_anchor_date(
  _anchor text,
  _data_nascimento date,
  _animal_payload jsonb,
  _fazenda_metadata jsonb
)
returns date
language sql
stable
as $$
  select case lower(coalesce(_anchor, ''))
    when 'birth' then _data_nascimento
    when 'weaning' then coalesce(
      public.sanitario_safe_date(nullif(_animal_payload #>> '{weaning,completed_at}', '')),
      case
        when _data_nascimento is null then null::date
        else _data_nascimento
          + coalesce(
            public.sanitario_safe_int(
              nullif(_fazenda_metadata #>> '{animal_lifecycle,weaning_days}', '')
            ),
            210
          )
      end
    )
    when 'dry_off' then
      public.sanitario_safe_date(
        nullif(_animal_payload #>> '{taxonomy_facts,data_secagem}', '')
      )
    else null::date
  end;
$$;

comment on function public.sanitario_resolve_anchor_date(text, date, jsonb, jsonb)
  is 'Resolve ancoras operacionais do calendario sanitario a partir de nascimento, payload do animal e metadata da fazenda.';

create or replace function public.sanitario_resolve_campaign_due_date(
  _months jsonb,
  _as_of date,
  _not_before date default null,
  _last_completion date default null
)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  v_months int[];
  v_year_start int;
  v_year_end int;
  v_candidate date;
begin
  select coalesce(array_agg(distinct month_num order by month_num), '{}'::int[])
    into v_months
  from (
    select public.sanitario_safe_int(value) as month_num
    from jsonb_array_elements_text(coalesce(_months, '[]'::jsonb)) as month_source(value)
  ) parsed
  where month_num between 1 and 12;

  if coalesce(array_length(v_months, 1), 0) = 0 then
    return null;
  end if;

  if _last_completion is not null then
    select min(make_date(candidate_year, candidate_month, 1))
      into v_candidate
    from generate_series(
      extract(year from _last_completion)::int,
      extract(year from _last_completion)::int + 2
    ) as candidate_year
    cross join unnest(v_months) as candidate_month
    where make_date(candidate_year, candidate_month, 1) > _last_completion
      and (
        _not_before is null
        or make_date(candidate_year, candidate_month, 1) >= _not_before
      );

    return v_candidate;
  end if;

  v_year_start := least(
    extract(year from coalesce(_not_before, _as_of))::int,
    extract(year from _as_of)::int
  );
  v_year_end := greatest(
    extract(year from coalesce(_not_before, _as_of))::int,
    extract(year from _as_of)::int
  ) + 2;

  select max(make_date(candidate_year, candidate_month, 1))
    into v_candidate
  from generate_series(v_year_start, v_year_end) as candidate_year
  cross join unnest(v_months) as candidate_month
  where make_date(candidate_year, candidate_month, 1) <= _as_of
    and (
      _not_before is null
      or make_date(candidate_year, candidate_month, 1) >= _not_before
    );

  if v_candidate is not null then
    return v_candidate;
  end if;

  select min(make_date(candidate_year, candidate_month, 1))
    into v_candidate
  from generate_series(v_year_start, v_year_end) as candidate_year
  cross join unnest(v_months) as candidate_month
  where make_date(candidate_year, candidate_month, 1) > _as_of
    and (
      _not_before is null
      or make_date(candidate_year, candidate_month, 1) >= _not_before
    );

  return v_candidate;
end;
$$;

comment on function public.sanitario_resolve_campaign_due_date(jsonb, date, date, date)
  is 'Resolve a data prevista declarativa para campanhas sanitarias a partir dos meses elegiveis, data de corte e ultima execucao.';

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
      lower(nullif(p.payload ->> 'status_legal', '')) as status_legal_eff
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
      ) as keep_after_window_eff
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
      a.sexo,
      a.payload as animal_payload,
      a.fazenda_metadata,
      p.id as protocolo_id,
      p.nome as protocolo_nome,
      p.payload as protocolo_payload,
      p.valido_de_eff,
      p.valido_ate_eff,
      p.especie_eff,
      p.categoria_eff,
      p.sexo_alvo_eff,
      p.sexos_alvo_eff,
      p.status_legal_eff,
      i.id as protocolo_item_id,
      i.tipo as item_tipo,
      i.produto as item_produto,
      i.dose_num_eff,
      i.intervalo_dias_eff,
      coalesce(i.idade_min_dias_eff, p.idade_min_dias_eff) as idade_min_dias_eff,
      coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff) as idade_max_dias_eff,
      i.dedup_template,
      i.depends_on_item_code_eff,
      i.item_code_eff,
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
    select *
    from matriz_base
    where keep_after_window_eff = true
      or eligibility_end_date_eff is null
      or v_ref_date <= eligibility_end_date_eff
  ),
  dose_context as (
    select
      m.*,
      exists (
        select 1
        from itens_base nx
        where nx.protocolo_id = m.protocolo_id
          and nx.dose_num_eff = m.dose_num_eff + 1
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
      and prev.dose_num_eff = dc.dose_num_eff - 1
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
    where dc.depends_on_item_code_eff is not null
      and psi_dep.payload ->> 'item_code' = dc.depends_on_item_code_eff
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
      end as anchor_trigger_due_eff
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
      ce.intervalo_dias_eff,
      ce.idade_min_dias_eff,
      ce.dedup_template,
      ce.calendar_mode_eff,
      ce.calendar_anchor_eff,
      case
        when ce.dose_num_eff > 1 then
          case
            when ce.intervalo_dias_eff is null then null::date
            when ce.ultima_data_prev is null then null::date
            when ce.ultima_data_item is not null
              and ce.ultima_data_item >= ce.ultima_data_prev then null::date
            else ce.ultima_data_prev + ce.intervalo_dias_eff
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
                    ce.ultima_data_item
                  )
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item is not null then
                  ce.ultima_data_item + ce.intervalo_dias_eff
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
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item is not null then
                  greatest(
                    ce.ultima_data_item + ce.intervalo_dias_eff,
                    coalesce(
                      ce.anchor_trigger_due_eff,
                      ce.ultima_data_item + ce.intervalo_dias_eff
                    )
                  )
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
                      when ce.ultima_data_item is null then ce.anchor_date_eff
                      else null::date
                    end
                  )
                when ce.ultima_data_item is not null then
                  null::date
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
                      when ce.ultima_data_item is null then ce.anchor_date_eff
                      else null::date
                    end,
                    case
                      when ce.ultima_data_item is null then ce.eligibility_start_date_eff
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
                      when ce.ultima_data_item is null then ce.anchor_date_eff
                      else null::date
                    end
                  )
              end
            else
              case
                when ce.depends_on_item_code_eff is not null then
                  case
                    when ce.intervalo_dias_eff is null then null::date
                    when ce.ultima_data_dep is null then null::date
                    when ce.ultima_data_item is not null then ce.ultima_data_item + ce.intervalo_dias_eff
                    else ce.ultima_data_dep + ce.intervalo_dias_eff
                  end
                when ce.has_next_dose then
                  case
                    when ce.ultima_data_item is not null then null::date
                    when ce.data_nascimento is null then null::date
                    else ce.data_nascimento + coalesce(ce.idade_min_dias_eff, 0)
                  end
                when ce.intervalo_dias_eff is not null and ce.ultima_data_item is not null then
                  ce.ultima_data_item + ce.intervalo_dias_eff
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
      public.render_dedup_key(
        c.dedup_template,
        c.animal_id,
        c.dose_num_eff,
        c.protocolo_item_id,
        c.data_prevista_calc
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
        'tipo', cv.item_tipo::text,
        'produto', cv.item_produto,
        'calendar_mode', cv.calendar_mode_eff,
        'calendar_anchor', cv.calendar_anchor_eff,
        'engine', 'sanitario_recompute_v2'
      ),
      null,
      cv.protocolo_item_id,
      cv.intervalo_dias_eff,
      jsonb_build_object(
        'protocolo_nome', cv.protocolo_nome,
        'produto', cv.item_produto,
        'calendar_mode', cv.calendar_mode_eff,
        'calendar_anchor', cv.calendar_anchor_eff
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
  is 'Motor declarativo de agenda sanitaria por campanha, janela etaria, intervalo recorrente e ancoras operacionais.';

create or replace function public.sanitario_recompute_agenda_for_animal(
  _animal_id uuid,
  _as_of date default current_date
)
returns integer
language plpgsql
set search_path = public
as $$
begin
  if _animal_id is null then
    return 0;
  end if;

  update public.agenda_itens ai
     set deleted_at = coalesce(ai.deleted_at, now()),
         updated_at = now()
   where ai.deleted_at is null
     and ai.dominio = 'sanitario'
     and ai.status = 'agendado'
     and ai.source_kind = 'automatico'
     and ai.animal_id = _animal_id;

  return public.sanitario_recompute_agenda_core(
    null,
    _animal_id,
    coalesce(_as_of, current_date)
  );
end;
$$;

create or replace function public.sanitario_recompute_agenda_for_fazenda(
  _fazenda_id uuid default null,
  _as_of date default current_date
)
returns integer
language plpgsql
set search_path = public
as $$
begin
  update public.agenda_itens ai
     set deleted_at = coalesce(ai.deleted_at, now()),
         updated_at = now()
   where ai.deleted_at is null
     and ai.dominio = 'sanitario'
     and ai.status = 'agendado'
     and ai.source_kind = 'automatico'
     and (_fazenda_id is null or ai.fazenda_id = _fazenda_id);

  return public.sanitario_recompute_agenda_core(
    _fazenda_id,
    null,
    coalesce(_as_of, current_date)
  );
end;
$$;

select public.sanitario_recompute_agenda_for_fazenda(null, current_date);
