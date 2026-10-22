-- R04 administrative authorization explicitly given by the human on 2026-10-20.
-- Target project: zqloazqzhwauamcejmuz (must also be selected by the caller).
-- Application role bootstrap only; no schema/grants/JWT impersonation/catalog decision.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $r04_grant$
declare
  target constant uuid := '0f00a75c-32a9-4555-a840-cb0f13f2d3f7';
  audit_id constant uuid := '9fdb61b5-11ca-455c-b262-34fbbc312670';
  authorization_ref constant text := 'R04_ADMIN_AUTHORIZATION_20261020';
  grant_row public.app_superadmins%rowtype;
  previous_audit public.app_admin_audit_events%rowtype;
  before_state jsonb;
  after_state jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('R04:app_superadmins:' || target::text, 0));
  if not exists(select 1 from auth.users where id = target and deleted_at is null) then
    raise exception 'R04_TARGET_AUTH_USER_NOT_FOUND';
  end if;
  select * into previous_audit from public.app_admin_audit_events where id = audit_id;
  if found then
    if previous_audit.action <> 'APP_SUPERADMIN_GRANTED'
      or previous_audit.actor_user_id <> target
      or previous_audit.target_id <> target::text
      or previous_audit.metadata->>'authorization_reference' <> authorization_ref
      or not exists(select 1 from public.app_superadmins where user_id = target) then
      raise exception 'R04_GRANT_RECEIPT_CONFLICT';
    end if;
    return; -- Same administrative request: preserve the original append-only receipt.
  end if;
  if exists(select 1 from public.app_superadmins) then
    raise exception 'R04_SUPERADMIN_BASELINE_DIVERGED';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 63 then
    raise exception 'R04_MIGRATION_BASELINE_DIVERGED';
  end if;
  select jsonb_build_object(
    'protocols', (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.sanitario_protocolos_v2 t),
    'items', (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.sanitario_protocolo_itens_versions_v2 t),
    'gates', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by fazenda_id)::text, '[]')) from public.sanitario_sync_v2_gates t),
    'events', (select count(*) from public.eventos),
    'agendas', (select count(*) from public.agenda_itens),
    'agendas_v2', (select count(*) from public.sanitario_agenda_v2),
    'stock', (select count(*) from public.insumo_movimentacoes)
  ) into before_state;
  insert into public.app_superadmins(user_id, notes, created_by)
  values (target, 'R04_ADMIN_AUTHORIZATION_20261020: explicit human authorization; global application role until revoked; catalog decisions require separate explicit confirmation.', null)
  returning * into grant_row;
  insert into public.app_admin_audit_events(
    id, actor_user_id, action, target_type, target_id, state_before, state_after, metadata
  ) values (
    audit_id, target, 'APP_SUPERADMIN_GRANTED', 'app_superadmins', target::text,
    jsonb_build_object('app_superadmin', false), to_jsonb(grant_row),
    jsonb_build_object(
      'authorization_reference', authorization_ref,
      'authorization_channel', 'explicit_human_message_in_current_task',
      'actor_user_id_semantics', 'Account identified by the human as their own and explicitly authorizing this administrative grant; not an authenticated Supabase session assertion.',
      'execution_channel', 'supabase_management_api',
      'database_executor', current_user,
      'database_auth_uid', auth.uid(),
      'supabase_authenticated_session_used', false,
      'created_by_is_null_reason', 'Management API operator has no Supabase Auth subject; no creator identity is fabricated.',
      'project_ref', 'zqloazqzhwauamcejmuz',
      'role_persists_until_revocation', true,
      'catalog_decisions_authorized', false,
      'r05_authorized', false
    )
  );
  select jsonb_build_object(
    'protocols', (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.sanitario_protocolos_v2 t),
    'items', (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.sanitario_protocolo_itens_versions_v2 t),
    'gates', (select md5(coalesce(jsonb_agg(to_jsonb(t) order by fazenda_id)::text, '[]')) from public.sanitario_sync_v2_gates t),
    'events', (select count(*) from public.eventos),
    'agendas', (select count(*) from public.agenda_itens),
    'agendas_v2', (select count(*) from public.sanitario_agenda_v2),
    'stock', (select count(*) from public.insumo_movimentacoes)
  ) into after_state;
  if before_state is distinct from after_state then
    raise exception 'R04_UNEXPECTED_CATALOG_OR_OPERATIONAL_CHANGE';
  end if;
  if (select count(*) from public.app_superadmins) <> 1 then
    raise exception 'R04_EXCLUSIVE_GRANT_CHECK_FAILED';
  end if;
end;
$r04_grant$;
commit;
