-- 20260825080000_app_superadmin_can_create_farm_mutation.sql
-- ============================================================================
-- RebanhoSync — Admin Track A4: Mutação Idempotente de can_create_farm + Auditoria
-- ============================================================================

drop function if exists public.admin_set_can_create_farm(uuid, boolean);

create or replace function public.admin_set_can_create_farm(
  _target_user_id uuid,
  _can_create boolean
)
returns table (
  user_id uuid,
  previous_can_create_farm boolean,
  can_create_farm boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_prev boolean;
  v_current boolean;
  v_changed boolean;
begin
  -- 1. Autorização Server-Side estrita
  if not public.is_app_admin() then
    raise exception 'Forbidden: Access denied' using errcode = '42501';
  end if;

  -- 2. Validação de parâmetros
  if _target_user_id is null or _can_create is null then
    raise exception 'Invalid arguments: target_user_id and can_create must be provided'
      using errcode = '22023';
  end if;

  -- 3. Bloqueio pessimista para evitar condições de corrida concorrentes
  select up.can_create_farm
  into v_prev
  from public.user_profiles up
  where up.user_id = _target_user_id
    and up.deleted_at is null
  for update;

  if not found then
    raise exception 'User profile not found for user %', _target_user_id
      using errcode = 'P0002';
  end if;

  -- 4. Idempotência e Auditoria Atômica
  if v_prev is not distinct from _can_create then
    v_changed := false;
    v_current := v_prev;
  else
    -- Mutação da fonte canônica existente com qualificação de tabela explícita
    update public.user_profiles up
    set can_create_farm = _can_create,
        updated_at = now()
    where up.user_id = _target_user_id;

    -- Inserção atômica na trilha de auditoria append-only
    insert into public.app_admin_audit_events (
      actor_user_id,
      action,
      target_type,
      target_id,
      state_before,
      state_after,
      metadata
    ) values (
      auth.uid(),
      'CAN_CREATE_FARM_SET',
      'user_profile',
      _target_user_id::text,
      jsonb_build_object('can_create_farm', v_prev),
      jsonb_build_object('can_create_farm', _can_create),
      jsonb_build_object('source', 'backoffice_admin')
    );

    v_changed := true;
    v_current := _can_create;
  end if;

  return query
  select
    _target_user_id,
    v_prev,
    v_current,
    v_changed;
end;
$$;

revoke all on function public.admin_set_can_create_farm(uuid, boolean) from public, anon;
grant execute on function public.admin_set_can_create_farm(uuid, boolean) to authenticated, service_role;
