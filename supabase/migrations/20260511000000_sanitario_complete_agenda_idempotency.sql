create or replace function public.sanitario_complete_agenda_with_event(
  _agenda_item_id uuid,
  _occurred_at timestamptz default now(),
  _tipo public.sanitario_tipo_enum default null,
  _produto text default null,
  _observacoes text default null,
  _sanitario_payload jsonb default '{}'::jsonb,
  _client_id text default 'server',
  _client_op_id uuid default gen_random_uuid(),
  _client_tx_id uuid default null,
  _client_recorded_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agenda public.agenda_itens%rowtype;
  v_evento_id uuid := gen_random_uuid();
  v_tipo public.sanitario_tipo_enum;
  v_produto text;
  v_protocol_item_version integer;
  v_calendar_mode text;
  v_period_mode text;
  v_window_start text;
  v_family_code text;
  v_milestone_code text;
  v_schedule_kind text;
  v_sequence_order integer;
  v_completed_on date;
  v_enriched_payload jsonb;
begin
  select * into v_agenda
  from public.agenda_itens
  where id = _agenda_item_id and dominio = 'sanitario' and deleted_at is null
  for update;

  if not found then
    raise exception 'Agenda sanitaria nao encontrada';
  end if;
  if not public.has_membership(v_agenda.fazenda_id) then
    raise exception 'Forbidden';
  end if;

  if v_agenda.status = 'concluido' then
    if v_agenda.source_evento_id is not null then
      return v_agenda.source_evento_id;
    end if;
    raise exception 'Agenda sanitaria ja estava concluida sem evento referenciado';
  elsif v_agenda.status <> 'agendado' then
    raise exception 'Agenda sanitaria nao esta elegivel para conclusao';
  end if;

  v_tipo := coalesce(_tipo, nullif(v_agenda.tipo, '')::public.sanitario_tipo_enum);
  v_produto := coalesce(nullif(_produto, ''), v_agenda.payload->>'produto', v_agenda.tipo);

  select psi.version into v_protocol_item_version
  from public.protocolos_sanitarios_itens psi
  where psi.id = v_agenda.protocol_item_version_id
    and psi.fazenda_id = v_agenda.fazenda_id
    and psi.deleted_at is null;

  v_calendar_mode := nullif(coalesce(
    v_agenda.payload #>> '{calendario_base,mode}',
    v_agenda.payload->>'calendario_mode',
    v_agenda.payload->>'calendar_mode',
    v_agenda.payload->>'mode'
  ), '');
  v_period_mode := coalesce(
    nullif(v_agenda.payload->>'period_mode', ''),
    case when v_calendar_mode is not null then public.sanitario_dedup_period_mode(v_calendar_mode) end
  );
  v_window_start := coalesce(
    nullif(v_agenda.payload->>'window_start', ''),
    case
      when v_period_mode = 'window'
       and v_agenda.dedup_key is not null
       and split_part(v_agenda.dedup_key, ':', 7) = 'window'
      then nullif(split_part(v_agenda.dedup_key, ':', 8), '')
    end
  );
  v_family_code := lower(nullif(coalesce(
    v_agenda.payload->>'family_code',
    v_agenda.payload #>> '{regime_sanitario,family_code}'
  ), ''));
  v_milestone_code := regexp_replace(lower(nullif(coalesce(
    v_agenda.payload->>'milestone_code',
    v_agenda.payload #>> '{regime_sanitario,milestone_code}',
    v_agenda.payload->>'item_code',
    v_agenda.payload->>'official_item_code'
  ), '')), '-', '_', 'g');
  if v_family_code = 'raiva_herbivoros' and v_milestone_code = 'raiva_reforco_30d' then
    v_milestone_code := 'raiva_d2';
  end if;
  v_schedule_kind := lower(nullif(coalesce(
    v_agenda.payload->>'schedule_kind',
    v_agenda.payload #>> '{regime_sanitario,schedule_kind}',
    v_agenda.payload #>> '{regime_sanitario,schedule_rule,kind}'
  ), ''));
  v_sequence_order := coalesce(
    case when nullif(v_agenda.payload->>'sequence_order', '') ~ '^[0-9]+$' then (v_agenda.payload->>'sequence_order')::integer end,
    case when nullif(v_agenda.payload #>> '{regime_sanitario,sequence_order}', '') ~ '^[0-9]+$' then (v_agenda.payload #>> '{regime_sanitario,sequence_order}')::integer end,
    case when nullif(v_agenda.payload->>'dose_num', '') ~ '^[0-9]+$' then (v_agenda.payload->>'dose_num')::integer end,
    case
      when v_family_code = 'raiva_herbivoros' and v_milestone_code = 'raiva_d1' then 1
      when v_family_code = 'raiva_herbivoros' and v_milestone_code = 'raiva_d2' then 2
      when v_family_code = 'raiva_herbivoros' and v_milestone_code = 'raiva_anual' then 3
    end
  );
  v_completed_on := (_occurred_at at time zone 'America/Sao_Paulo')::date;
  v_enriched_payload :=
    coalesce(_sanitario_payload, '{}'::jsonb) ||
    jsonb_build_object(
      'sanitary_completion',
      jsonb_build_object(
        'schema_version', 1,
        'sanitary_completion_key', v_agenda.dedup_key,
        'agenda_dedup_key', v_agenda.dedup_key,
        'subject_type', case when v_agenda.animal_id is not null then 'animal' end,
        'animal_id', v_agenda.animal_id,
        'family_code', v_family_code,
        'milestone_code', v_milestone_code,
        'sequence_order', v_sequence_order,
        'schedule_kind', v_schedule_kind,
        'completed_on', v_completed_on,
        'official_item_code', coalesce(
          case when v_family_code = 'raiva_herbivoros' then v_milestone_code end,
          v_agenda.payload->>'official_item_code'
        ),
        'protocol_item_version_id', v_agenda.protocol_item_version_id,
        'protocol_item_version', coalesce(
          v_protocol_item_version,
          case when nullif(v_agenda.payload->>'protocol_item_version', '') ~ '^[0-9]+$' then (v_agenda.payload->>'protocol_item_version')::integer end,
          case when nullif(v_agenda.payload->>'regimen_version', '') ~ '^[0-9]+$' then (v_agenda.payload->>'regimen_version')::integer end
        ),
        'period_mode', v_period_mode,
        'window_start', v_window_start,
        'source_agenda_item_id', v_agenda.id
      )
    );

  insert into public.eventos (
    id, fazenda_id, dominio, occurred_at, animal_id, lote_id, source_task_id,
    source_tx_id, source_client_op_id, observacoes, payload, client_id,
    client_op_id, client_tx_id, client_recorded_at, server_received_at
  ) values (
    v_evento_id, v_agenda.fazenda_id, 'sanitario', _occurred_at,
    v_agenda.animal_id, v_agenda.lote_id, v_agenda.id,
    _client_tx_id, _client_op_id, _observacoes,
    v_enriched_payload,
    _client_id, _client_op_id, _client_tx_id, _client_recorded_at, now()
  );

  insert into public.eventos_sanitario (
    evento_id, fazenda_id, tipo, produto, payload, client_id,
    client_op_id, client_tx_id, client_recorded_at, server_received_at
  ) values (
    v_evento_id, v_agenda.fazenda_id, v_tipo, v_produto,
    v_enriched_payload,
    _client_id, _client_op_id, _client_tx_id, _client_recorded_at, now()
  );

  update public.agenda_itens
  set status = 'concluido',
      source_evento_id = v_evento_id,
      updated_at = now()
  where id = v_agenda.id;

  perform public.sanitario_recompute_agenda_core(v_agenda.fazenda_id, v_agenda.animal_id, (_occurred_at at time zone 'America/Sao_Paulo')::date);
  return v_evento_id;
end;
$$;
