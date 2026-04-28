-- Phase 1: Reproduction Events View and Indexes
-- Safe: No new columns or tables, just views and indexes.

-- 1. View for Timeline
create or replace view vw_eventos_reproducao_timeline as
select
    e.id as evento_id,
    e.fazenda_id,
    e.occurred_at,
    e.animal_id,
    e.lote_id,
    e.observacoes,
    er.tipo,
    er.macho_id,
    er.payload as payload_reproducao,
    e.payload as payload_evento,
    e.corrige_evento_id,
    e.created_at,
    e.client_id,
    e.client_op_id
from
    eventos e
join
    eventos_reproducao er on e.id = er.evento_id
where
    e.dominio = 'reproducao'
    and e.deleted_at is null;

-- 2. Performance Index for Timeline queries
-- Drop if exists to be idempotent
drop index if exists idx_eventos_reproducao_timeline_cover;

create index idx_eventos_reproducao_timeline_cover
on eventos (fazenda_id, dominio, animal_id, occurred_at desc)
where dominio = 'reproducao' and deleted_at is null;

-- 3. Index on child table for joins
drop index if exists idx_eventos_reproducao_lookup;
create index idx_eventos_reproducao_lookup
on eventos_reproducao (evento_id, fazenda_id, tipo);
