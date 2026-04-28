-- 0018_add_rebanho_performance_indexes.sql
-- =========================================================
-- Índices de performance para gestão do rebanho
-- Fase 1: Performance e Filtros — Índices de Alto Impacto
-- =========================================================

do $$
begin
  -- ANIMAIS: Índices multi-tenant first
  if not exists (
    select 1 from pg_indexes
    where tablename = 'animais' and indexname = 'idx_animais_status'
  ) then
    create index idx_animais_status
      on public.animais (fazenda_id, status)
      where deleted_at is null;
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'animais' and indexname = 'idx_animais_lote'
  ) then
    create index idx_animais_lote
      on public.animais (fazenda_id, lote_id)
      where deleted_at is null and lote_id is not null;
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'animais' and indexname = 'idx_animais_sexo'
  ) then
    create index idx_animais_sexo
      on public.animais (fazenda_id, sexo)
      where deleted_at is null;
  end if;

  -- EVENTOS: occurred_at (não occurred_on), fazenda_id first
  if not exists (
    select 1 from pg_indexes
    where tablename = 'eventos' and indexname = 'idx_eventos_fazenda_dominio_occurred'
  ) then
    create index idx_eventos_fazenda_dominio_occurred
      on public.eventos (fazenda_id, dominio, occurred_at desc)
      where deleted_at is null;
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'eventos' and indexname = 'idx_eventos_fazenda_animal_occurred'
  ) then
    create index idx_eventos_fazenda_animal_occurred
      on public.eventos (fazenda_id, animal_id, occurred_at desc)
      where deleted_at is null and animal_id is not null;
  end if;

  -- AGENDA: data_prevista + status
  if not exists (
    select 1 from pg_indexes
    where tablename = 'agenda_itens' and indexname = 'idx_agenda_fazenda_data'
  ) then
    create index idx_agenda_fazenda_data
      on public.agenda_itens (fazenda_id, data_prevista)
      where deleted_at is null and status = 'agendado';
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'agenda_itens' and indexname = 'idx_agenda_fazenda_status'
  ) then
    create index idx_agenda_fazenda_status
      on public.agenda_itens (fazenda_id, status)
      where deleted_at is null;
  end if;
end $$;

-- Comentários para documentação
comment on index public.idx_animais_status is 'Filtro multi-tenant por status - Lista de animais';
comment on index public.idx_animais_lote is 'Filtro multi-tenant por lote - Detalhes do lote';
comment on index public.idx_animais_sexo is 'Filtro multi-tenant por sexo - Relatórios por sexo';
comment on index public.idx_eventos_fazenda_dominio_occurred is 'Timeline de eventos por fazenda e domínio';
comment on index public.idx_eventos_fazenda_animal_occurred is 'Timeline de eventos por animal específico';
comment on index public.idx_agenda_fazenda_data is 'Ordenação da agenda por data - Página Agenda';
comment on index public.idx_agenda_fazenda_status is 'Filtro de agenda por status - Agendados vs. Finalizados';
