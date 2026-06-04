-- Fase 9A: idempotencia remota da baixa nutricional por evento/source.

create unique index if not exists ux_insumo_movimentacoes_consumo_nutricao_evento
  on public.insumo_movimentacoes (fazenda_id, source_evento_id)
  where tipo = 'consumo_nutricao'
    and source_evento_id is not null
    and deleted_at is null;
