-- F24.1 — Canonical forward-only ACL reconciliation.
--
-- This migration describes the current desired privilege state. It is not a
-- replay of the staging-only 20260901192728 repair. RLS remains unchanged and
-- continues to constrain rows after these object-level grants.

-- Existing relations: deny by default, then restore only the application and
-- backend surfaces that are used by the current clients.
revoke all privileges on all tables in schema public
  from public, anon, authenticated, service_role;

grant select, insert, update on table
  public.user_profiles,
  public.user_settings,
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

grant select, update on table public.fazendas to authenticated;

grant select on table
  public.user_fazendas,
  public.farm_invites,
  public.eventos_animais,
  public.app_superadmins,
  public.app_admin_audit_events,
  public.catalogo_protocolos_oficiais,
  public.catalogo_protocolos_oficiais_itens,
  public.catalogo_doencas_notificaveis,
  public.produtos_veterinarios,
  public.sanitario_agenda_v2,
  public.sanitario_agenda_animais_v2,
  public.sanitario_agenda_closures_v2,
  public.sanitario_fontes_tecnicas_v2,
  public.sanitario_fonte_cobertura_campos_v2,
  public.sanitario_produtos_v2,
  public.sanitario_produto_especie_autorizacao_v2,
  public.sanitario_produto_fontes_v2,
  public.sanitario_produto_dose_rules_v2,
  public.sanitario_produto_carencia_rules_v2,
  public.sanitario_produto_carencia_fontes_v2,
  public.sanitario_protocolos_v2,
  public.sanitario_protocolo_itens_versions_v2,
  public.sanitario_product_classes_v2,
  public.sanitario_product_class_groups_v2,
  public.sanitario_product_class_group_members_v2,
  public.sanitario_product_class_default_rules_v2,
  public.vw_sanitario_pendencias,
  public.vw_sanitario_historico,
  public.vw_sanitario_upcoming
to authenticated;

-- Server-only direct access used by sync-batch and sanitario-reconcile. The
-- service role is intentionally not granted blanket access to public.
grant select on table
  public.user_fazendas,
  public.fazendas,
  public.animais,
  public.eventos,
  public.eventos_sanitario,
  public.eventos_animais,
  public.sanitario_produtos_v2,
  public.sanitario_fontes_tecnicas_v2,
  public.sanitario_fonte_cobertura_campos_v2,
  public.sanitario_produto_fontes_v2,
  public.sanitario_produto_dose_rules_v2,
  public.sanitario_produto_carencia_rules_v2,
  public.sanitario_produto_carencia_fontes_v2,
  public.sanitario_produto_especie_autorizacao_v2,
  public.app_superadmins,
  public.app_admin_audit_events
to service_role;

grant select, insert, update, delete on table
  public.sanitario_sync_v2_gates
to service_role;

grant select, insert on table
  public.sanitario_sync_v2_operations,
  public.sanitario_agenda_closures_v2,
  public.eventos,
  public.eventos_sanitario,
  public.eventos_animais
to service_role;

grant select, insert, update on table
  public.sanitario_agenda_v2
to service_role;

grant select, insert, update, delete on table
  public.sanitario_agenda_animais_v2
to service_role;

grant select, update on table
  public.fazenda_sanidade_config
to service_role;

-- There are no application-owned sequences today, but drifted environments
-- and future objects must not expose sequence capabilities implicitly.
revoke all privileges on all sequences in schema public
  from public, anon, authenticated, service_role;

-- Functions default to PUBLIC EXECUTE in PostgreSQL. Normalize every current
-- function first, then restore the reviewed RPC/internal entrypoints by exact
-- signature.
revoke execute on all functions in schema public
  from public, anon, authenticated, service_role;

grant execute on function
  public.get_invite_preview(uuid),
  public.reject_invite(uuid)
to anon;

grant execute on function
  public.accept_invite(uuid),
  public.admin_get_platform_metrics(),
  public.admin_get_platform_user(uuid),
  public.admin_list_platform_farms(text, integer, integer),
  public.admin_list_platform_invites(text, text, integer, integer),
  public.admin_list_platform_users(text, integer, integer),
  public.admin_remove_member(uuid, uuid),
  public.admin_set_can_create_farm(uuid, boolean),
  public.admin_set_member_role(uuid, uuid, public.farm_role_enum),
  public.apply_commercial_operation_v2(uuid, uuid, uuid, jsonb),
  public.apply_individual_animal_purchase(uuid, uuid, uuid, jsonb, jsonb, jsonb),
  public.can_create_farm(),
  public.cancel_invite(uuid),
  public.create_fazenda(text, text, text, public.estado_uf_enum, text, numeric, public.tipo_producao_enum, public.sistema_manejo_enum),
  public.create_invite(uuid, text, text, public.farm_role_enum),
  public.get_invite_preview(uuid),
  public.get_user_emails(uuid[]),
  public.has_farm_role(uuid, public.farm_role_enum[]),
  public.has_membership(uuid),
  public.is_app_admin(),
  public.materialize_standard_sanitary_protocols(uuid),
  public.reject_invite(uuid),
  public.role_in_fazenda(uuid, public.farm_role_enum[]),
  public.sanitario_complete_agenda_with_event(uuid, timestamp with time zone, public.sanitario_tipo_enum, text, text, jsonb, text, uuid, uuid, timestamp with time zone),
  public.sanitario_recompute_agenda_for_animal(uuid, uuid, date),
  public.sanitario_recompute_agenda_for_fazenda(uuid, date)
to authenticated;

grant execute on function
  public.admin_get_platform_metrics(),
  public.admin_get_platform_user(uuid),
  public.admin_list_platform_farms(text, integer, integer),
  public.admin_list_platform_invites(text, text, integer, integer),
  public.admin_list_platform_users(text, integer, integer),
  public.admin_set_can_create_farm(uuid, boolean),
  public.guard_sanitario_sync_v2_internal_writes(),
  public.internal_sanitario_sync_v2_apply_factual_core(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_event_input, public.sanitario_sync_v2_detail_input, public.sanitario_sync_v2_event_animal_input[]),
  public.internal_sanitario_sync_v2_authorize(uuid, uuid, integer, text, text, public.farm_role_enum[]),
  public.internal_sanitario_sync_v2_close_agenda(uuid, uuid, integer, uuid, uuid, bigint, public.sanitario_sync_v2_closure_input),
  public.internal_sanitario_sync_v2_create_agenda(uuid, uuid, integer, uuid, uuid, public.sanitario_sync_v2_agenda_input, uuid[]),
  public.internal_sanitario_sync_v2_existing_result(uuid, text, uuid, uuid, uuid, text),
  public.internal_sanitario_sync_v2_replace_agenda_animals(uuid, uuid, integer, uuid, uuid, bigint, uuid, text, uuid[]),
  public.is_app_admin(),
  public.prevent_eventos_animais_mutation(),
  public.sanitario_reconcile_eligible_fazendas(timestamp with time zone),
  public.sanitario_reconcile_touch(uuid)
to service_role;

-- Future objects created by the migration owner are opt-in. Every current
-- application object in public is owned by postgres; Supabase-managed
-- supabase_admin defaults are outside the authority of the migration role.
-- Each future application migration must grant its own API surface.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
