-- 0034_sanitario_vaccine_only_and_restrictions.sql
-- Ajustes sanitarios:
-- 1) agenda automatica apenas para vacinacao
-- 2) restricoes de sexo/idade por payload de protocolo/item
-- 3) dependencia opcional por item_code para evitar doses simultaneas de protocolos diferentes
-- 4) desativa templates legados de vermifugacao/medicacao

create or replace function public.seed_default_sanitary_protocols(_fazenda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id constant text := 'system:seed:mapa-sbmv:v2';
  v_now timestamptz := now();
  v_seed_tx_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(
    hashtext('seed_default_sanitary_protocols'),
    hashtext(_fazenda_id::text)
  );

  with protocol_templates as (
    select *
    from (
      values
        (
          'MAPA_BRUCELOSE_FEMEAS_3A8M_V2',
          'MAPA | Brucelose femeas 3-8 meses (B19/RB51)',
          'Vacinacao oficial do PNCEBT para femeas bovinas e bubalinas entre 3 e 8 meses.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_obrigatoria',
            'alvo', 'femeas_bovinas_bubalinas_3a8_meses',
            'sexo_alvo', 'F',
            'obrigatorio', true,
            'requires_vet', true,
            'requires_compliance_document', true,
            'notes',
              'Registrar comprovante no SVO e marcacao sanitaria conforme vacina utilizada (B19/RB51).'
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
          'MAPA | Raiva herbivoros - primovacinacao (areas de risco)',
          'Aplicacao inicial em herbivoros em area de ocorrencia de raiva, com reforco apos 30 dias.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_preventiva',
            'alvo', 'herbivoros_em_areas_de_ocorrencia',
            'obrigatorio_por_risco', true,
            'requires_vet_supervision', true
          )
        ),
        (
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2',
          'MAPA | Raiva herbivoros - revacinacao anual (areas de risco)',
          'Revacinacao periodica anual apos protocolo de primovacinacao concluido.',
          true,
          jsonb_build_object(
            'categoria', 'vacinacao_preventiva',
            'alvo', 'herbivoros_em_areas_de_ocorrencia',
            'obrigatorio_por_risco', true
          )
        )
    ) as t(template_code, nome, descricao, ativo, payload)
  )
  insert into public.protocolos_sanitarios (
    id,
    fazenda_id,
    nome,
    descricao,
    ativo,
    payload,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at
  )
  select
    gen_random_uuid(),
    _fazenda_id,
    t.nome,
    t.descricao,
    t.ativo,
    t.payload
      || jsonb_build_object(
        'template_code', t.template_code,
        'seed_version', '2026-02-12',
        'seed_origin', 'MAPA_SBMV'
      ),
    v_client_id,
    gen_random_uuid(),
    v_seed_tx_id,
    v_now
  from protocol_templates t
  where not exists (
    select 1
    from public.protocolos_sanitarios p
    where p.fazenda_id = _fazenda_id
      and p.payload ->> 'template_code' = t.template_code
      and p.deleted_at is null
  );

  with protocol_base as (
    select
      p.id as protocolo_id,
      p.fazenda_id,
      p.payload ->> 'template_code' as template_code
    from public.protocolos_sanitarios p
    where p.fazenda_id = _fazenda_id
      and p.deleted_at is null
  ),
  item_templates as (
    select *
    from (
      values
        (
          'MAPA_BRUCELOSE_FEMEAS_3A8M_V2',
          'BRUCELOSE_DOSE_UNICA',
          'vacinacao',
          'Vacina Brucelose B19 ou RB51 (conforme SVO/RT)',
          1,
          1,
          true,
          'brucelose:{animal_id}:dose:{dose_num}',
          jsonb_build_object(
            'alvo', 'femeas_3a8_meses',
            'sexo_alvo', 'F',
            'idade_minima_dias', 90,
            'idade_maxima_dias', 240,
            'dose_unica', true,
            'vias_recomendadas', jsonb_build_array('subcutanea')
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
          'RAIVA_PRIMOVAC_D1',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          30,
          1,
          true,
          'raiva:{animal_id}:d1',
          jsonb_build_object(
            'dose_ml', 2,
            'dose_stage', 'D1',
            'next_item_code', 'RAIVA_PRIMOVAC_D2',
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular')
          )
        ),
        (
          'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V2',
          'RAIVA_PRIMOVAC_D2',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          1,
          2,
          false,
          'raiva:{animal_id}:d2',
          jsonb_build_object(
            'dose_ml', 2,
            'dose_stage', 'D2',
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular')
          )
        ),
        (
          'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V2',
          'RAIVA_REVAC_ANUAL',
          'vacinacao',
          'Vacina antirrabica inativada (2 mL, SC/IM)',
          365,
          1,
          true,
          'raiva:{animal_id}:anual',
          jsonb_build_object(
            'dose_ml', 2,
            'idade_minima_dias', 365,
            'depends_on_item_code', 'RAIVA_PRIMOVAC_D2',
            'vias_recomendadas', jsonb_build_array('subcutanea', 'intramuscular')
          )
        )
    ) as t(
      template_code,
      item_code,
      tipo,
      produto,
      intervalo_dias,
      dose_num,
      gera_agenda,
      dedup_template,
      payload
    )
  )
  insert into public.protocolos_sanitarios_itens (
    id,
    fazenda_id,
    protocolo_id,
    protocol_item_id,
    version,
    tipo,
    produto,
    intervalo_dias,
    dose_num,
    gera_agenda,
    dedup_template,
    payload,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at
  )
  select
    gen_random_uuid(),
    _fazenda_id,
    p.protocolo_id,
    gen_random_uuid(),
    1,
    t.tipo::public.sanitario_tipo_enum,
    t.produto,
    t.intervalo_dias,
    t.dose_num,
    t.gera_agenda,
    t.dedup_template,
    t.payload
      || jsonb_build_object(
        'item_code', t.item_code,
        'seed_version', '2026-02-12',
        'seed_origin', 'MAPA_SBMV'
      ),
    v_client_id,
    gen_random_uuid(),
    v_seed_tx_id,
    v_now
  from item_templates t
  join protocol_base p
    on p.template_code = t.template_code
  where not exists (
    select 1
    from public.protocolos_sanitarios_itens i
    where i.fazenda_id = _fazenda_id
      and i.protocolo_id = p.protocolo_id
      and i.payload ->> 'item_code' = t.item_code
      and i.deleted_at is null
  );

  -- Desativa templates legados V1 e nao vacinais.
  update public.protocolos_sanitarios p
     set ativo = false,
         deleted_at = coalesce(p.deleted_at, v_now),
         updated_at = now()
   where p.fazenda_id = _fazenda_id
     and p.deleted_at is null
     and p.payload ->> 'template_code' in (
       'MAPA_BRUCELOSE_FEMEAS_3A8M_V1',
       'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
       'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
       'SBMV_VERMIFUGACAO_ESTRATEGICA_V1',
       'SBMV_MAPA_MEDICACAO_USO_PRUDENTE_V1'
     );

  update public.protocolos_sanitarios_itens i
     set gera_agenda = false,
         deleted_at = coalesce(i.deleted_at, v_now),
         updated_at = now()
    from public.protocolos_sanitarios p
   where i.fazenda_id = _fazenda_id
     and i.deleted_at is null
     and p.id = i.protocolo_id
     and p.fazenda_id = i.fazenda_id
     and p.payload ->> 'template_code' in (
       'MAPA_BRUCELOSE_FEMEAS_3A8M_V1',
       'MAPA_RAIVA_PRIMOVAC_AREAS_RISCO_V1',
       'MAPA_RAIVA_REVAC_ANUAL_AREAS_RISCO_V1',
       'SBMV_VERMIFUGACAO_ESTRATEGICA_V1',
       'SBMV_MAPA_MEDICACAO_USO_PRUDENTE_V1'
     );
end;
$$;

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
  with animais_alvo as (
    select
      a.id,
      a.fazenda_id,
      a.lote_id,
      a.data_nascimento,
      a.sexo,
      a.status,
      a.payload
    from public.animais a
    where a.deleted_at is null
      and a.status = 'ativo'
      and (_fazenda_id is null or a.fazenda_id = _fazenda_id)
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
      ) as idade_max_dias_eff
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
      i.intervalo_dias,
      i.payload,
      i.dedup_template,
      coalesce(i.dose_num, 1) as dose_num_eff,
      coalesce(
        public.sanitario_safe_int(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'idade_minima_dias')
        ),
        public.sanitario_safe_int(i.payload #>> '{janela_etaria_meses,min}') * 30
      ) as idade_min_dias_eff,
      coalesce(
        public.sanitario_safe_int(
          public.sanitario_pick_text(to_jsonb(i), i.payload, 'idade_maxima_dias')
        ),
        public.sanitario_safe_int(i.payload #>> '{janela_etaria_meses,max}') * 30
      ) as idade_max_dias_eff,
      public.sanitario_safe_int(
        public.sanitario_pick_text(to_jsonb(i), i.payload, 'intervalo_dias')
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
      nullif(i.payload ->> 'item_code', '') as item_code_eff
    from public.protocolos_sanitarios_itens i
    where i.deleted_at is null
      and i.gera_agenda = true
      and i.tipo = 'vacinacao'::public.sanitario_tipo_enum
      and (_fazenda_id is null or i.fazenda_id = _fazenda_id)
  ),
  matriz as (
    select
      a.id as animal_id,
      a.fazenda_id,
      a.lote_id,
      a.data_nascimento,
      a.sexo,
      a.payload as animal_payload,
      p.id as protocolo_id,
      p.nome as protocolo_nome,
      p.payload as protocolo_payload,
      p.valido_de_eff,
      p.valido_ate_eff,
      p.especie_eff,
      p.categoria_eff,
      p.sexo_alvo_eff,
      p.sexos_alvo_eff,
      p.idade_min_dias_eff as protocolo_idade_min_dias_eff,
      p.idade_max_dias_eff as protocolo_idade_max_dias_eff,
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
      i.sexos_alvo_eff as item_sexos_alvo_eff
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
      and (
        coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff) is null
        or (
          a.data_nascimento is not null
          and (v_ref_date - a.data_nascimento) <= coalesce(i.idade_max_dias_eff, p.idade_max_dias_eff)
        )
      )
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
  candidatos as (
    select
      dc.fazenda_id,
      dc.animal_id,
      dc.lote_id,
      dc.protocolo_id,
      dc.protocolo_nome,
      dc.protocolo_item_id,
      dc.item_tipo,
      dc.item_produto,
      dc.dose_num_eff,
      dc.intervalo_dias_eff,
      dc.idade_min_dias_eff,
      dc.dedup_template,
      case
        when dc.dose_num_eff > 1 then
          case
            when dc.intervalo_dias_eff is null then null::date
            when uprev.ultima_data_prev is null then null::date
            when ui.ultima_data_item is not null
              and ui.ultima_data_item >= uprev.ultima_data_prev then null::date
            else uprev.ultima_data_prev + dc.intervalo_dias_eff
          end
        else
          case
            when dc.depends_on_item_code_eff is not null then
              case
                when dc.intervalo_dias_eff is null then null::date
                when udep.ultima_data_dep is null then null::date
                when ui.ultima_data_item is not null then ui.ultima_data_item + dc.intervalo_dias_eff
                else udep.ultima_data_dep + dc.intervalo_dias_eff
              end
            when dc.has_next_dose then
              case
                when ui.ultima_data_item is not null then null::date
                when dc.data_nascimento is null then null::date
                else dc.data_nascimento + coalesce(dc.idade_min_dias_eff, 0)
              end
            when dc.intervalo_dias_eff is not null and ui.ultima_data_item is not null then
              ui.ultima_data_item + dc.intervalo_dias_eff
            when dc.data_nascimento is null then
              null::date
            else
              dc.data_nascimento + coalesce(dc.idade_min_dias_eff, 0)
          end
      end as data_prevista_calc
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
        'engine', 'sanitario_recompute'
      ),
      null,
      cv.protocolo_item_id,
      cv.intervalo_dias_eff,
      jsonb_build_object(
        'protocolo_nome', cv.protocolo_nome,
        'produto', cv.item_produto
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
  is 'Motor set-based de pendencias sanitarias com foco em vacinacao e restricoes por payload.';

-- Aplicar novo seed e desativacoes para fazendas existentes.
do $$
declare
  f record;
begin
  for f in
    select id
    from public.fazendas
    where deleted_at is null
  loop
    perform public.seed_default_sanitary_protocols(f.id);
  end loop;
end $$;

-- Limpa pendencias automaticas anteriores para recomputar com as novas regras.
update public.agenda_itens ai
   set deleted_at = coalesce(ai.deleted_at, now()),
       updated_at = now()
 where ai.deleted_at is null
   and ai.dominio = 'sanitario'
   and ai.status = 'agendado'
   and ai.source_kind = 'automatico';

-- Recalculo global idempotente.
select public.sanitario_recompute_agenda_for_fazenda(null, current_date);
