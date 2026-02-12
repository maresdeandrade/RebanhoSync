-- 0028_sanitario_agenda_engine.sql
-- Motor sanitario: geracao automatica de pendencias, conclusao idempotente
-- via evento com source_task_id e views para painel sanitario.

create or replace function public.sanitario_safe_int(_value text)
returns int
language sql
immutable
as $$
  select
    case
      when _value is null then null
      when btrim(_value) ~ '^-?[0-9]+$' then btrim(_value)::int
      else null
    end;
$$;

create or replace function public.sanitario_safe_date(_value text)
returns date
language sql
immutable
as $$
  select
    case
      when _value is null then null
      when btrim(_value) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then btrim(_value)::date
      else null
    end;
$$;

create or replace function public.sanitario_safe_bool(_value text)
returns boolean
language sql
immutable
as $$
  select
    case lower(coalesce(btrim(_value), ''))
      when 'true' then true
      when 't' then true
      when '1' then true
      when 'yes' then true
      when 'y' then true
      when 'false' then false
      when 'f' then false
      when '0' then false
      when 'no' then false
      when 'n' then false
      else null
    end;
$$;

create or replace function public.sanitario_pick_text(_row jsonb, _payload jsonb, _key text)
returns text
language sql
immutable
as $$
  select nullif(coalesce(_row ->> _key, _payload ->> _key), '');
$$;

create or replace function public.sanitario_json_array_contains_ci(_arr jsonb, _value text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(_arr) = 'array' then _arr
        else '[]'::jsonb
      end
    ) as e(v)
    where lower(e.v) = lower(coalesce(_value, ''))
  );
$$;

create or replace function public.render_dedup_key(
  _template text,
  _animal_id uuid,
  _dose_num int,
  _protocolo_id uuid default null,
  _ref_date date default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_template text := coalesce(
    nullif(_template, ''),
    'sanitario:{animal_id}:item:{protocolo_id}:dose:{dose_num}:ref:{ref_date}'
  );
  v_ref_date date := coalesce(_ref_date, current_date);
  v_result text;
begin
  v_result := v_template;
  v_result := replace(v_result, '{animal_id}', coalesce(_animal_id::text, '-'));
  v_result := replace(v_result, '{dose_num}', coalesce(_dose_num::text, '1'));
  v_result := replace(v_result, '{protocolo_id}', coalesce(_protocolo_id::text, '-'));
  v_result := replace(v_result, '{ref_date}', to_char(v_ref_date, 'YYYY-MM-DD'));
  v_result := replace(v_result, '{ano}', to_char(v_ref_date, 'YYYY'));
  v_result := replace(v_result, '{mes}', to_char(v_ref_date, 'MM'));
  v_result := replace(v_result, '{dia}', to_char(v_ref_date, 'DD'));
  v_result := replace(v_result, '{yyyymm}', to_char(v_ref_date, 'YYYYMM'));
  v_result := replace(v_result, '{yyyy_mm}', to_char(v_ref_date, 'YYYY_MM'));

  return lower(v_result);
end;
$$;

comment on function public.render_dedup_key(text, uuid, int, uuid, date)
  is 'Renderiza dedup_key deterministica para agenda sanitaria.';

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
  is 'Motor set-based de pendencias sanitarias (animal/fazenda).';

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
  return public.sanitario_recompute_agenda_core(
    _fazenda_id,
    null,
    coalesce(_as_of, current_date)
  );
end;
$$;

create or replace function public.trg_sanitario_recompute_agenda_on_animais()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sanitario_recompute_agenda_for_animal(new.id);
    return new;
  end if;

  if new.data_nascimento is distinct from old.data_nascimento
    or new.sexo is distinct from old.sexo
    or new.status is distinct from old.status
    or new.lote_id is distinct from old.lote_id
    or new.payload is distinct from old.payload
    or new.deleted_at is distinct from old.deleted_at
    or new.raca is distinct from old.raca then
    perform public.sanitario_recompute_agenda_for_animal(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_animais_sanitario_recompute on public.animais;
create trigger trg_animais_sanitario_recompute
after insert or update on public.animais
for each row
execute function public.trg_sanitario_recompute_agenda_on_animais();

create or replace function public.trg_sanitario_close_agenda_on_event_detail()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_evento public.eventos%rowtype;
  v_agenda_animal uuid;
begin
  select e.*
    into v_evento
  from public.eventos e
  where e.id = new.evento_id
    and e.fazenda_id = new.fazenda_id
    and e.dominio = 'sanitario'
    and e.deleted_at is null
  limit 1;

  if not found or v_evento.source_task_id is null then
    return new;
  end if;

  update public.agenda_itens ai
     set status = 'concluido',
         source_evento_id = v_evento.id,
         payload = coalesce(ai.payload, '{}'::jsonb)
           || jsonb_build_object(
             'completed_at', v_evento.occurred_at,
             'completed_by_evento_id', v_evento.id
           )
   where ai.id = v_evento.source_task_id
     and ai.fazenda_id = v_evento.fazenda_id
     and ai.dominio = 'sanitario'
     and ai.deleted_at is null
     and (
       ai.status is distinct from 'concluido'::public.agenda_status_enum
       or ai.source_evento_id is distinct from v_evento.id
     )
  returning ai.animal_id into v_agenda_animal;

  if v_agenda_animal is not null then
    perform public.sanitario_recompute_agenda_for_animal(
      v_agenda_animal,
      v_evento.occurred_on
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_evt_sanitario_close_agenda on public.eventos_sanitario;
create trigger trg_evt_sanitario_close_agenda
after insert on public.eventos_sanitario
for each row
execute function public.trg_sanitario_close_agenda_on_event_detail();

create or replace function public.sanitario_complete_agenda_with_event(
  _agenda_item_id uuid,
  _occurred_at timestamptz default now(),
  _tipo public.sanitario_tipo_enum default null,
  _produto text default null,
  _observacoes text default null,
  _sanitario_payload jsonb default '{}'::jsonb,
  _client_id text default 'app:rpc:sanitario',
  _client_op_id uuid default gen_random_uuid(),
  _client_tx_id uuid default null,
  _client_recorded_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_agenda public.agenda_itens%rowtype;
  v_evento_id uuid;
  v_item_tipo public.sanitario_tipo_enum;
  v_item_produto text;
  v_occurred_at timestamptz := coalesce(_occurred_at, now());
  v_detail_rows int := 0;
begin
  select ai.*
    into v_agenda
  from public.agenda_itens ai
  where ai.id = _agenda_item_id
    and ai.deleted_at is null
    and ai.dominio = 'sanitario'
  for update;

  if not found then
    raise exception 'agenda_item % nao encontrado para dominio sanitario', _agenda_item_id
      using errcode = 'P0001';
  end if;

  if v_agenda.protocol_item_version_id is not null then
    select i.tipo, i.produto
      into v_item_tipo, v_item_produto
    from public.protocolos_sanitarios_itens i
    where i.id = v_agenda.protocol_item_version_id
      and i.fazenda_id = v_agenda.fazenda_id
      and i.deleted_at is null
    limit 1;
  end if;

  select e.id
    into v_evento_id
  from public.eventos e
  where e.fazenda_id = v_agenda.fazenda_id
    and e.source_task_id = v_agenda.id
    and e.dominio = 'sanitario'
    and e.deleted_at is null
  order by e.created_at asc
  limit 1;

  if v_evento_id is null then
    v_evento_id := gen_random_uuid();

    insert into public.eventos (
      id,
      fazenda_id,
      dominio,
      occurred_at,
      animal_id,
      lote_id,
      source_task_id,
      source_tx_id,
      source_client_op_id,
      corrige_evento_id,
      observacoes,
      payload,
      client_id,
      client_op_id,
      client_tx_id,
      client_recorded_at
    )
    values (
      v_evento_id,
      v_agenda.fazenda_id,
      'sanitario'::public.dominio_enum,
      v_occurred_at,
      v_agenda.animal_id,
      v_agenda.lote_id,
      v_agenda.id,
      _client_tx_id,
      _client_op_id,
      null,
      _observacoes,
      coalesce(_sanitario_payload, '{}'::jsonb)
        || jsonb_build_object(
          'agenda_item_id', v_agenda.id,
          'source', 'sanitario_complete_agenda_with_event'
        ),
      coalesce(nullif(_client_id, ''), 'app:rpc:sanitario'),
      _client_op_id,
      _client_tx_id,
      coalesce(_client_recorded_at, now())
    );
  end if;

  insert into public.eventos_sanitario (
    evento_id,
    fazenda_id,
    tipo,
    produto,
    payload,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at
  )
  values (
    v_evento_id,
    v_agenda.fazenda_id,
    coalesce(_tipo, v_item_tipo, 'vacinacao'::public.sanitario_tipo_enum),
    coalesce(
      nullif(btrim(_produto), ''),
      v_item_produto,
      nullif(v_agenda.payload ->> 'produto', ''),
      'Procedimento sanitario'
    ),
    coalesce(_sanitario_payload, '{}'::jsonb),
    coalesce(nullif(_client_id, ''), 'app:rpc:sanitario'),
    gen_random_uuid(),
    _client_tx_id,
    coalesce(_client_recorded_at, now())
  )
  on conflict (evento_id) do nothing;

  get diagnostics v_detail_rows = row_count;

  update public.agenda_itens ai
     set status = 'concluido',
         source_evento_id = v_evento_id,
         payload = coalesce(ai.payload, '{}'::jsonb)
           || jsonb_build_object(
             'completed_at', v_occurred_at,
             'completed_by_evento_id', v_evento_id
           )
   where ai.id = v_agenda.id
     and ai.deleted_at is null
     and (
       ai.status is distinct from 'concluido'::public.agenda_status_enum
       or ai.source_evento_id is distinct from v_evento_id
     );

  -- Replay idempotente: se detalhe ja existia, reforca recompute da proxima dose.
  if v_detail_rows = 0 and v_agenda.animal_id is not null then
    perform public.sanitario_recompute_agenda_for_animal(
      v_agenda.animal_id,
      v_occurred_at::date
    );
  end if;

  return v_evento_id;
end;
$$;

comment on function public.sanitario_complete_agenda_with_event(
  uuid, timestamptz, public.sanitario_tipo_enum, text, text, jsonb, text, uuid, uuid, timestamptz
) is 'Conclui agenda sanitaria e cria evento/evento_sanitario na mesma transacao, de forma idempotente.';

create unique index if not exists ux_agenda_dedup_active
on public.agenda_itens(fazenda_id, dedup_key)
where status = 'agendado' and deleted_at is null and dedup_key is not null;

create index if not exists idx_agenda_sanitario_animal_status_data
on public.agenda_itens(fazenda_id, animal_id, status, data_prevista)
where dominio = 'sanitario' and deleted_at is null;

create index if not exists idx_agenda_sanitario_protocol_item_active
on public.agenda_itens(fazenda_id, protocol_item_version_id, animal_id, data_prevista)
where dominio = 'sanitario' and status = 'agendado' and deleted_at is null;

create index if not exists idx_eventos_sanitario_source_task
on public.eventos(fazenda_id, source_task_id, occurred_at desc)
where dominio = 'sanitario' and source_task_id is not null and deleted_at is null;

create index if not exists idx_protocolos_sanitarios_ativos
on public.protocolos_sanitarios(fazenda_id, ativo)
where deleted_at is null;

create index if not exists idx_protocolos_itens_recompute
on public.protocolos_sanitarios_itens(fazenda_id, protocolo_id, dose_num, gera_agenda)
where deleted_at is null;

create or replace view public.vw_sanitario_pendencias
with (security_invoker = true)
as
select
  ai.id as agenda_item_id,
  ai.fazenda_id,
  ai.animal_id,
  a.identificacao as animal_identificacao,
  a.nome as animal_nome,
  ai.lote_id,
  ai.data_prevista,
  greatest((current_date - ai.data_prevista), 0)::int as dias_em_atraso,
  ai.status,
  ai.tipo as agenda_tipo,
  ai.dedup_key,
  ai.source_kind,
  ai.source_ref,
  ai.protocol_item_version_id as protocolo_item_id,
  psi.protocolo_id,
  ps.nome as protocolo_nome,
  psi.tipo as sanitario_tipo,
  coalesce(psi.produto, ai.payload ->> 'produto') as produto,
  coalesce(psi.dose_num, 1) as dose_num,
  psi.intervalo_dias,
  public.sanitario_safe_date(
    public.sanitario_pick_text(to_jsonb(ps), ps.payload, 'valido_de')
  ) as protocolo_valido_de,
  public.sanitario_safe_date(
    public.sanitario_pick_text(to_jsonb(ps), ps.payload, 'valido_ate')
  ) as protocolo_valido_ate,
  ai.created_at,
  ai.updated_at
from public.agenda_itens ai
left join public.animais a
  on a.id = ai.animal_id
  and a.fazenda_id = ai.fazenda_id
  and a.deleted_at is null
left join public.protocolos_sanitarios_itens psi
  on psi.id = ai.protocol_item_version_id
  and psi.fazenda_id = ai.fazenda_id
  and psi.deleted_at is null
left join public.protocolos_sanitarios ps
  on ps.id = psi.protocolo_id
  and ps.fazenda_id = ai.fazenda_id
  and ps.deleted_at is null
where ai.deleted_at is null
  and ai.dominio = 'sanitario'
  and ai.status = 'agendado';

create or replace view public.vw_sanitario_historico
with (security_invoker = true)
as
select
  e.id as evento_id,
  e.fazenda_id,
  e.animal_id,
  a.identificacao as animal_identificacao,
  a.nome as animal_nome,
  e.lote_id,
  e.occurred_at,
  e.occurred_on,
  e.source_task_id as agenda_item_id,
  ai.data_prevista as agenda_data_prevista,
  ai.status as agenda_status,
  es.tipo as sanitario_tipo,
  es.produto,
  ai.protocol_item_version_id as protocolo_item_id,
  psi.protocolo_id,
  ps.nome as protocolo_nome,
  coalesce(psi.dose_num, 1) as dose_num,
  e.observacoes,
  es.payload as sanitario_payload,
  e.payload as evento_payload
from public.eventos e
join public.eventos_sanitario es
  on es.evento_id = e.id
  and es.fazenda_id = e.fazenda_id
  and es.deleted_at is null
left join public.agenda_itens ai
  on ai.id = e.source_task_id
  and ai.fazenda_id = e.fazenda_id
  and ai.deleted_at is null
left join public.animais a
  on a.id = e.animal_id
  and a.fazenda_id = e.fazenda_id
  and a.deleted_at is null
left join public.protocolos_sanitarios_itens psi
  on psi.id = ai.protocol_item_version_id
  and psi.fazenda_id = e.fazenda_id
  and psi.deleted_at is null
left join public.protocolos_sanitarios ps
  on ps.id = psi.protocolo_id
  and ps.fazenda_id = e.fazenda_id
  and ps.deleted_at is null
where e.deleted_at is null
  and e.dominio = 'sanitario';

create or replace view public.vw_sanitario_upcoming
with (security_invoker = true)
as
select
  p.agenda_item_id,
  p.fazenda_id,
  p.animal_id,
  p.animal_identificacao,
  p.animal_nome,
  p.lote_id,
  p.data_prevista,
  (p.data_prevista - current_date)::int as dias_para_vencimento,
  p.sanitario_tipo,
  p.produto,
  p.protocolo_id,
  p.protocolo_nome,
  p.dose_num,
  p.intervalo_dias,
  p.protocolo_valido_de,
  p.protocolo_valido_ate,
  p.dedup_key
from public.vw_sanitario_pendencias p
where p.data_prevista >= current_date;
