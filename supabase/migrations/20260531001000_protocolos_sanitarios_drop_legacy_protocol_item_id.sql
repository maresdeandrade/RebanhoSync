-- Fase 1C: contracao do contrato legado de etapa de protocolo sanitario.
-- Agenda/evento usam protocol_item_version_id; etapa logica usa logical_item_key.

update public.agenda_itens
set
  source_ref = coalesce(source_ref, '{}'::jsonb) - 'protocol_item_id' - 'protocolo_item_id',
  payload = coalesce(payload, '{}'::jsonb) - 'protocol_item_id' - 'protocolo_item_id'
where dominio = 'sanitario'
  and (
    coalesce(source_ref, '{}'::jsonb) ?| array['protocol_item_id', 'protocolo_item_id']
    or coalesce(payload, '{}'::jsonb) ?| array['protocol_item_id', 'protocolo_item_id']
  );

update public.eventos_sanitario
set
  payload = coalesce(payload, '{}'::jsonb) - 'protocol_item_id' - 'protocolo_item_id',
  protocol_item_snapshot =
    case
      when protocol_item_snapshot is null then null
      else protocol_item_snapshot - 'protocol_item_id' - 'protocolo_item_id'
    end
where coalesce(payload, '{}'::jsonb) ?| array['protocol_item_id', 'protocolo_item_id']
   or coalesce(protocol_item_snapshot, '{}'::jsonb) ?| array['protocol_item_id', 'protocolo_item_id'];

alter table public.protocolos_sanitarios_itens
  drop constraint if exists protocolos_sanitarios_itens_fazenda_id_protocolo_id_protocol_item_id_version_key;

alter table public.protocolos_sanitarios_itens
  drop column if exists protocol_item_id;
