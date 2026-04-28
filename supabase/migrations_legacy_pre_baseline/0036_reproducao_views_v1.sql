-- Reporting Views for Reproduction V1
-- These views are for BI/Metabase/Reporting only and do not affect application logic.
-- They expose the JSONB payload structure as relational columns.

-- DROP existing views first to allow schema changes (avoid "cannot drop columns" error)
DROP VIEW IF EXISTS public.vw_repro_status_animal;
DROP VIEW IF EXISTS public.vw_repro_episodios;

-- 1. Episode View (Links Services -> Diags -> Partos)
-- Flattens the event hierarchy based on 'episode_evento_id'.
create or replace view vw_repro_episodios as
select 
    e.id as evento_id,
    e.fazenda_id,
    e.animal_id,
    e.occurred_at,
    er.tipo,
    
    -- Extract V1 fields
    (er.payload->>'schema_version')::int as schema_version,
    er.payload->>'episode_evento_id' as linked_service_id,
    er.payload->>'episode_link_method' as link_method,
    
    -- Details
    er.payload->>'tecnica_livre' as tecnica,
    er.payload->>'reprodutor_tag' as touro,
    er.payload->>'lote_semen' as semen,
    er.payload->>'resultado' as resultado_diag,
    er.payload->>'data_prevista_parto' as data_prevista,
    er.payload->>'data_parto_real' as data_parto,
    (er.payload->>'numero_crias')::int as crias

from eventos e
join eventos_reproducao er on e.id = er.evento_id
where e.deleted_at is null;

-- 2. Animal Status View (Snapshot)
-- Note: This is an approximation using SQL window functions to replicate the 'status.ts' logic.
-- It may not be 100% identical to the frontend logic due to complexity, but serves for reporting.
create or replace view vw_repro_status_animal as
with latest_events as (
    select 
        e.animal_id,
        e.fazenda_id,
        er.tipo,
        e.occurred_at,
        er.payload,
        row_number() over (partition by e.animal_id order by e.occurred_at desc) as rn
    from eventos e
    join eventos_reproducao er on e.id = er.evento_id
    where e.deleted_at is null
)
select 
    animal_id,
    fazenda_id,
    occurred_at as last_event_date,
    tipo as last_event_type,
    case 
        when tipo = 'parto' and (current_date - occurred_at::date) <= 60 then 'PARIDA_PUERPERIO'
        when tipo = 'parto' then 'VAZIA' -- Parida > 60d
        when tipo = 'diagnostico' and (payload->>'resultado' = 'positivo' or payload->>'diagnostico_resultado' = 'positivo') then 'PRENHA'
        when tipo = 'diagnostico' and (payload->>'resultado' = 'negativo' or payload->>'diagnostico_resultado' = 'negativo') then 'VAZIA'
        when tipo = 'cobertura' or tipo = 'IA' then 'SERVIDA'
        else 'VAZIA'
    end as status_estimado
from latest_events
where rn = 1;
