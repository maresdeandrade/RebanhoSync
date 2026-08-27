-- Migration: C2 — Hardening de search_path em funções SECURITY INVOKER
-- Corrige function_search_path_mutable nas 10 funções restantes em public.
-- Referências a objetos de domínio permanecem totalmente qualificadas (public.*).

-- 1. set_updated_at
ALTER FUNCTION public.set_updated_at() SET search_path = '';

-- 2. set_event_occurred_on
ALTER FUNCTION public.set_event_occurred_on() SET search_path = '';

-- 3. prevent_admin_audit_mutation
ALTER FUNCTION public.prevent_admin_audit_mutation() SET search_path = '';

-- 4. prevent_business_update
ALTER FUNCTION public.prevent_business_update() SET search_path = '';

-- 5. prevent_insumo_movimentacao_update
ALTER FUNCTION public.prevent_insumo_movimentacao_update() SET search_path = '';

-- 6. sanitario_dedup_period_mode
ALTER FUNCTION public.sanitario_dedup_period_mode(text) SET search_path = '';

-- 7. render_sanitario_canonical_dedup_key
ALTER FUNCTION public.render_sanitario_canonical_dedup_key(text, uuid, text, text, integer, text, text, text) SET search_path = '';

-- 8. render_dedup_key
ALTER FUNCTION public.render_dedup_key(text, uuid, uuid, uuid, integer, date) SET search_path = '';

-- 9. fn_validate_product_class_default_rule_v2
ALTER FUNCTION public.fn_validate_product_class_default_rule_v2() SET search_path = '';

-- 10. fn_validate_product_class_group_member_v2
ALTER FUNCTION public.fn_validate_product_class_group_member_v2() SET search_path = '';
