-- Phase 3B: View SQL vw_animais_carencia_ativa (F1)
-- Active withdrawal periods derived from sanitary events.

create or replace view public.vw_animais_carencia_ativa
with (security_invoker = true)
as
select
  e.animal_id,
  e.fazenda_id,
  es.produto,
  'carne' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,carne_dias}')::integer as fim_carencia,
  ((e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,carne_dias}')::integer) >= current_date as ativa
from public.eventos e
join public.eventos_sanitario es
  on es.evento_id = e.id
 and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario'
  and e.deleted_at is null
  and es.deleted_at is null
  and e.animal_id is not null
  and (es.payload #>> '{carencia_regra_json,carne_dias}') is not null
  and (es.payload #>> '{carencia_regra_json,carne_dias}')::integer > 0
  and ((e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,carne_dias}')::integer) >= current_date

union all

select
  e.animal_id,
  e.fazenda_id,
  es.produto,
  'leite' as tipo_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date as inicio_carencia,
  (e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,leite_dias}')::integer as fim_carencia,
  ((e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,leite_dias}')::integer) >= current_date as ativa
from public.eventos e
join public.eventos_sanitario es
  on es.evento_id = e.id
 and es.fazenda_id = e.fazenda_id
where e.dominio = 'sanitario'
  and e.deleted_at is null
  and es.deleted_at is null
  and e.animal_id is not null
  and (es.payload #>> '{carencia_regra_json,leite_dias}') is not null
  and (es.payload #>> '{carencia_regra_json,leite_dias}')::integer > 0
  and ((e.occurred_at at time zone 'America/Sao_Paulo')::date
    + (es.payload #>> '{carencia_regra_json,leite_dias}')::integer) >= current_date;
