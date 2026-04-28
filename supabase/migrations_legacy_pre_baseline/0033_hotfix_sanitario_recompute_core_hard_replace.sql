-- 0033_hotfix_sanitario_recompute_core_hard_replace.sql
-- Hard replace da funcao core para evitar hotfixes por replace textual.
-- Tambem aplica backfill set-based para popular agenda sanitaria existente.

create unique index if not exists ux_agenda_dedup_active
on public.agenda_itens(fazenda_id, dedup_key)
where status = 'agendado' and deleted_at is null and dedup_key is not null;

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
      ) as sexo_alvo_eff
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
      ) as item_ativo_eff
    from public.protocolos_sanitarios_itens i
    where i.deleted_at is null
      and i.gera_agenda = true
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
      i.id as protocolo_item_id,
      i.tipo as item_tipo,
      i.produto as item_produto,
      i.dose_num_eff,
      i.intervalo_dias_eff,
      i.idade_min_dias_eff,
      i.idade_max_dias_eff,
      i.dedup_template
    from animais_alvo a
    join protocolos_base p
      on p.fazenda_id = a.fazenda_id
    join itens_base i
      on i.fazenda_id = a.fazenda_id
      and i.protocolo_id = p.id
      and i.item_ativo_eff = true
    where (p.valido_de_eff is null or v_ref_date >= p.valido_de_eff)
      and (p.valido_ate_eff is null or v_ref_date <= p.valido_ate_eff)
      and (
        p.sexo_alvo_eff is null
        or p.sexo_alvo_eff = upper(a.sexo::text)
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
        i.idade_max_dias_eff is null
        or (
          a.data_nascimento is not null
          and (v_ref_date - a.data_nascimento) <= i.idade_max_dias_eff
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
            -- Falha segura: sem intervalo em dose > 1, nao gera pendencia.
            when dc.intervalo_dias_eff is null then null::date
            when uprev.ultima_data_prev is null then null::date
            -- Se a dose atual ja foi aplicada para a ultima dose anterior, nao reabre.
            when ui.ultima_data_item is not null
              and ui.ultima_data_item >= uprev.ultima_data_prev then null::date
            else uprev.ultima_data_prev + dc.intervalo_dias_eff
          end
        else
          case
            when dc.has_next_dose then
              case
                -- D1 de protocolo sequencial: gera apenas ate a primeira aplicacao.
                when ui.ultima_data_item is not null then null::date
                when dc.data_nascimento is null then null::date
                else dc.data_nascimento + coalesce(dc.idade_min_dias_eff, 0)
              end
            when dc.intervalo_dias_eff is not null and ui.ultima_data_item is not null then
              ui.ultima_data_item + dc.intervalo_dias_eff
            when dc.data_nascimento is null then
              null::date
            else
              -- Regra fixa D1: nascimento + idade minima (default 0 quando ausente).
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
  is 'Motor set-based de pendencias sanitarias (hard-replace hotfix).';

-- Backfill unico para materializar pendencias apos hotfix.
select public.sanitario_recompute_agenda_for_fazenda(null, current_date);
