-- Identity, bootstrap, farm selection, and farm context.
grant select, insert, update on table public.user_profiles to authenticated;
grant select, insert, update on table public.user_settings to authenticated;
grant select, update on table public.fazendas to authenticated;
grant select on table public.user_fazendas to authenticated;
grant select on table public.farm_invites to authenticated;

-- Mutable tenant-scoped state reached by pull and sync-batch.
grant select, insert, update on table
  public.pastos,
  public.lotes,
  public.animais,
  public.contrapartes,
  public.fazenda_sanidade_config,
  public.protocolos_sanitarios,
  public.protocolos_sanitarios_itens,
  public.agenda_itens,
  public.sanitario_casos,
  public.pasto_ocupacoes,
  public.insumos,
  public.insumo_apresentacoes,
  public.insumo_lotes,
  public.sociedades_pecuarias,
  public.sociedade_animais
to authenticated;

-- Append-only facts, ledgers, and telemetry. SELECT is required by pull,
-- replay detection, and INSERT ... RETURNING in the authenticated client.
grant select, insert on table
  public.eventos,
  public.eventos_sanitario,
  public.eventos_pesagem,
  public.eventos_nutricao,
  public.eventos_movimentacao,
  public.eventos_reproducao,
  public.eventos_financeiro,
  public.eventos_ecc,
  public.eventos_comercial,
  public.eventos_pasto_avaliacao,
  public.insumo_movimentacoes,
  public.finance_categories,
  public.finance_transactions,
  public.metrics_events
to authenticated;
