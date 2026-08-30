-- C2A: fix only the functions still reported by function_search_path_mutable.
-- Function bodies, signatures, owners, security mode and grants remain unchanged.

alter function public.set_updated_at()
  set search_path = '';

alter function public.prevent_business_update()
  set search_path = '';

alter function public.set_event_occurred_on()
  set search_path = '';

alter function public.render_sanitario_canonical_dedup_key(text, uuid, text, text, integer, text, text, text)
  set search_path = '';

alter function public.sanitario_dedup_period_mode(text)
  set search_path = '';

alter function public.render_dedup_key(text, uuid, uuid, uuid, integer, date)
  set search_path = '';

alter function public.prevent_insumo_movimentacao_update()
  set search_path = '';

alter function public.fn_validate_product_class_group_member_v2()
  set search_path = '';

alter function public.fn_validate_product_class_default_rule_v2()
  set search_path = '';

alter function public.prevent_admin_audit_mutation()
  set search_path = '';
