-- Migration: Hardening de privilégios de execução de RPCs de domínio e administração de fazenda
-- C1: Revoga EXECUTE de PUBLIC e anon em RPCs autenticadas; mantém EXECUTE apenas para authenticated e service_role.
-- Configura explicitamente as RPCs com anon intencional (get_invite_preview, reject_invite).

-- 1. Farm and Membership Admin RPCs
REVOKE EXECUTE ON FUNCTION public.create_fazenda(text, text, text, public.estado_uf_enum, text, numeric, public.tipo_producao_enum, public.sistema_manejo_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_fazenda(text, text, text, public.estado_uf_enum, text, numeric, public.tipo_producao_enum, public.sistema_manejo_enum) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_create_farm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_farm() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_remove_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_member_role(uuid, uuid, public.farm_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_member_role(uuid, uuid, public.farm_role_enum) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_invite(uuid, text, text, public.farm_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invite(uuid, text, text, public.farm_role_enum) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invite(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid) TO authenticated;

-- 2. Sanitário Domain RPCs & Helpers
REVOKE EXECUTE ON FUNCTION public.materialize_standard_sanitary_protocols(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_standard_sanitary_protocols(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sanitario_complete_agenda_with_event(uuid, timestamp with time zone, public.sanitario_tipo_enum, text, text, jsonb, text, uuid, uuid, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitario_complete_agenda_with_event(uuid, timestamp with time zone, public.sanitario_tipo_enum, text, text, jsonb, text, uuid, uuid, timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sanitario_recompute_agenda_core(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitario_recompute_agenda_core(uuid, uuid, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sanitario_recompute_agenda_for_animal(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitario_recompute_agenda_for_animal(uuid, uuid, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sanitario_recompute_agenda_for_fazenda(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitario_recompute_agenda_for_fazenda(uuid, date) TO authenticated;

-- 3. RLS Helper Functions (SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.has_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_membership(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.role_in_fazenda(uuid, public.farm_role_enum[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_in_fazenda(uuid, public.farm_role_enum[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_farm_role(uuid, public.farm_role_enum[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_farm_role(uuid, public.farm_role_enum[]) TO authenticated;

-- 4. Intentional Public Anon Entrypoints
-- Revoga PUBLIC para evitar herança implícita e concede explicitamente a anon e authenticated
REVOKE EXECUTE ON FUNCTION public.get_invite_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_invite(uuid) TO anon, authenticated;
