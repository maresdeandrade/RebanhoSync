-- Phase 2A: Read Model de Peso Atual (F2)
-- Consolidated view for current animal weight.

create or replace view public.vw_animais_peso_atual
with (security_invoker = true)
as
select distinct on (e.animal_id, e.fazenda_id)
  e.animal_id,
  e.fazenda_id,
  ep.peso_kg,
  e.occurred_at as pesado_em,
  (current_date - (e.occurred_at at time zone 'America/Sao_Paulo')::date) as dias_desde_pesagem,
  ((current_date - (e.occurred_at at time zone 'America/Sao_Paulo')::date) > 90) as stale
from public.eventos e
join public.eventos_pesagem ep
  on ep.evento_id = e.id
 and ep.fazenda_id = e.fazenda_id
where e.dominio = 'pesagem'
  and e.deleted_at is null
  and ep.deleted_at is null
  and e.animal_id is not null
order by e.animal_id, e.fazenda_id, e.occurred_at desc;
