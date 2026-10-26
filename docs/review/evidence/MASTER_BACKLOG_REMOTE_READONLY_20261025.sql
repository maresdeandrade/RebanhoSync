-- MASTER-BACKLOG-01: diagnóstico agregado, sem dados pessoais ou escrita.
-- Projeto identificado pelo conector: RebanhoSync / zqloazqzhwauamcejmuz.
-- Execução observada: 2026-10-25T19:54:54.963409Z.
BEGIN READ ONLY;
SELECT jsonb_build_object(
  'observed_at', now(),
  'constraint', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', conname, 'validated', convalidated,
      'definition', pg_get_constraintdef(oid)))
    FROM pg_constraint
    WHERE conname = 'fk_eventos_sanitario_lote_insumo_fazenda'
  ),
  'protocols', (
    SELECT jsonb_agg(x) FROM (
      SELECT scope::text, status::text, approval_status::text, count(*)
      FROM public.sanitario_protocolos_v2 WHERE deleted_at IS NULL
      GROUP BY scope, status, approval_status
    ) x
  ),
  'products', (
    SELECT jsonb_agg(x) FROM (
      SELECT status_curatorial::text, count(*)
      FROM public.sanitario_produtos_v2 WHERE deleted_at IS NULL
      GROUP BY status_curatorial
    ) x
  ),
  'legacy_counts', jsonb_build_object(
    'produtos_veterinarios', (SELECT count(*) FROM public.produtos_veterinarios),
    'protocolos_sanitarios', (SELECT count(*) FROM public.protocolos_sanitarios),
    'protocolos_sanitarios_itens', (SELECT count(*) FROM public.protocolos_sanitarios_itens)
  ),
  'rls', (
    SELECT jsonb_agg(jsonb_build_object('table', relname, 'rls', relrowsecurity))
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND relname IN (
      'produtos_veterinarios', 'protocolos_sanitarios', 'protocolos_sanitarios_itens',
      'sanitario_protocolos_v2', 'sanitario_produtos_v2', 'eventos_animais',
      'fazenda_sanidade_config'
    )
  )
) AS diagnostic;
COMMIT;
