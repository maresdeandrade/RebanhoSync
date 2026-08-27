-- Migration: Hardening de privilégios de execução de funções internas e triggers SECURITY DEFINER
-- C1: Remove privilégios EXECUTE desnecessários de PUBLIC, anon e authenticated.
-- Corrige search_path mutável em seed_default_finance_categories (C1_SEARCH_PATH_BLOCKER).

-- 1. seed_default_finance_categories()
-- C1_SEARCH_PATH_BLOCKER: fixar search_path
ALTER FUNCTION public.seed_default_finance_categories() SET search_path = 'public';
REVOKE EXECUTE ON FUNCTION public.seed_default_finance_categories() FROM PUBLIC, anon, authenticated;

-- 2. apply_insumo_movimentacao_saldo()
REVOKE EXECUTE ON FUNCTION public.apply_insumo_movimentacao_saldo() FROM PUBLIC, anon, authenticated;

-- 3. trg_sanitario_recompute_on_animal_mutation()
REVOKE EXECUTE ON FUNCTION public.trg_sanitario_recompute_on_animal_mutation() FROM PUBLIC, anon, authenticated;

-- 4. Funções de serviço interno (sanitario-reconcile cron)
REVOKE EXECUTE ON FUNCTION public.sanitario_reconcile_eligible_fazendas(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitario_reconcile_eligible_fazendas(timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sanitario_reconcile_touch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sanitario_reconcile_touch(uuid) TO service_role;

-- 5. Funções legadas de recompute v1 (substituídas pela fundação v2)
REVOKE EXECUTE ON FUNCTION public.sanitario_recompute_agenda_core_without_dry_cow(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitario_recompute_dry_cow_therapy_agenda(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
