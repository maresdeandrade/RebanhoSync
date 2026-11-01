-- Forward correction: use existing stock trigger's row lock/negative-balance
-- constraint instead of requiring UPDATE privileges on lots for SELECT FOR UPDATE.
begin;
create or replace function public.apply_sanitario_v3_confirmed_inventory()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.eventos%rowtype; d public.eventos_sanitario%rowtype;
  m jsonb; lot public.insumo_lotes%rowtype; qty numeric;
begin
  if new.operation_kind <> 'factual_core' then return new; end if;
  select * into e from public.eventos where id=new.entity_id and fazenda_id=new.fazenda_id;
  if e.sanitario_v3_confirmation is distinct from 'confirmed' then return new; end if;
  if current_user <> 'service_role' or current_setting('rebanhosync.sanitario_v3_actor',true) is distinct from new.actor_user_id::text
    or current_setting('rebanhosync.sanitario_v3_farm',true) is distinct from new.fazenda_id::text then
    raise exception 'SANITARIO_SINGLE_ADMISSION_REQUIRED' using errcode='42501'; end if;
  select * into d from public.eventos_sanitario where evento_id=e.id and fazenda_id=e.fazenda_id;
  m := e.payload->'inventory_movement';
  if m is null and d.estoque_lote_id is null then return new; end if;
  if m is null or d.estoque_lote_id is null or d.insumo_id is null
    or (m->>'id')::uuid is distinct from e.id
    or (m->>'insumo_id')::uuid is distinct from d.insumo_id
    or (m->>'insumo_lote_id')::uuid is distinct from d.estoque_lote_id
    or (m->>'client_op_id')::uuid is null or (m->>'domain_op_id')::uuid is null then
    raise exception 'SANITARIO_INVENTORY_SOURCE_MISMATCH' using errcode='23514'; end if;
  select * into lot from public.insumo_lotes where id=d.estoque_lote_id and fazenda_id=e.fazenda_id;
  qty := (m->>'quantidade_base')::numeric;
  if not found or lot.deleted_at is not null or lot.insumo_id is distinct from d.insumo_id
    or lot.unidade_base is distinct from m->>'unidade_base' or qty is null or qty<=0
    or qty='NaN'::numeric or qty>lot.saldo_atual_base then
    raise exception 'SANITARIO_INVENTORY_INVALID_OR_INSUFFICIENT' using errcode='23514'; end if;
  insert into public.insumo_movimentacoes(id,fazenda_id,insumo_id,insumo_lote_id,tipo,quantidade_base,unidade_base,
    occurred_at,source_evento_id,source_evento_dominio,animal_id,payload,client_id,client_op_id,client_tx_id,
    client_recorded_at,domain_op_id,custo_unitario_snapshot,custo_total_snapshot)
  values(e.id,e.fazenda_id,d.insumo_id,d.estoque_lote_id,'consumo_sanitario',qty,lot.unidade_base,
    e.occurred_at,e.id,'sanitario',e.animal_id,jsonb_build_object('source','sanitary_progressive_v3'),
    e.client_id,(m->>'client_op_id')::uuid,e.client_tx_id,e.client_recorded_at,(m->>'domain_op_id')::uuid,
    d.custo_unitario_snapshot,d.custo_total_snapshot);
  return new;
end $$;
create or replace view public.vw_animais_carencia_ativa
with (security_invoker = true)
as
select
  targets.animal_id,
  e.fazenda_id,
  coalesce(es.produto_nome_snapshot, es.produto) as produto,
  'carne' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  es.carencia_carne_ate as fim_carencia,
  es.carencia_carne_ate >= current_date as ativa
from public.eventos e
cross join lateral (
  select ea.animal_id from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=e.fazenda_id
  union select e.animal_id where e.animal_id is not null and not exists(select 1 from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=e.fazenda_id)
) targets
join public.eventos_sanitario es
  on es.evento_id = e.id
  and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario' and (e.sanitario_v3_confirmation is null or e.sanitario_v3_confirmation='confirmed')
  and e.deleted_at is null
  and es.deleted_at is null
  and targets.animal_id is not null
  and es.carencia_carne_dias is not null
  and es.carencia_carne_dias > 0
  and es.carencia_carne_ate is not null
  and es.carencia_carne_ate >= current_date

union all

select
  targets.animal_id,
  e.fazenda_id,
  coalesce(es.produto_nome_snapshot, es.produto) as produto,
  'leite' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  es.carencia_leite_ate as fim_carencia,
  es.carencia_leite_ate >= current_date as ativa
from public.eventos e
cross join lateral (
  select ea.animal_id from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=e.fazenda_id
  union select e.animal_id where e.animal_id is not null and not exists(select 1 from public.eventos_animais ea where ea.evento_id=e.id and ea.fazenda_id=e.fazenda_id)
) targets
join public.eventos_sanitario es
  on es.evento_id = e.id
  and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario' and (e.sanitario_v3_confirmation is null or e.sanitario_v3_confirmation='confirmed')
  and e.deleted_at is null
  and es.deleted_at is null
  and targets.animal_id is not null
  and es.carencia_leite_dias is not null
  and es.carencia_leite_dias > 0
  and es.carencia_leite_ate is not null
  and es.carencia_leite_ate >= current_date;

commit;
