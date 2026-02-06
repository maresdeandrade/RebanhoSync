-- 0011_fix_create_fazenda_permissions.sql
-- =========================================================
-- create_fazenda com gating híbrido + UPSERT robusto
-- =========================================================

create or replace function public.create_fazenda(
  _nome text,
  _codigo text default null,
  _municipio text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  _user_id uuid;
  _fazenda_id uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Gating híbrido: owner existente OU can_create_farm=true
  if not public.can_create_farm() then
    raise exception 'Forbidden - você não tem permissão para criar fazendas';
  end if;

  -- 1) Criar fazenda
  insert into public.fazendas (
    nome,
    codigo,
    municipio,
    created_by,
    client_id,
    client_op_id,
    client_recorded_at
  )
  values (
    _nome,
    _codigo,
    _municipio,
    _user_id,
    'server',
    gen_random_uuid(),
    now()
  )
  returning id into _fazenda_id;

  -- 2) Criar membership owner
  insert into public.user_fazendas (
    user_id,
    fazenda_id,
    role,
    is_primary,
    invited_by,
    accepted_at,
    client_id,
    client_op_id,
    client_recorded_at
  )
  values (
    _user_id,
    _fazenda_id,
    'owner',
    true,
    _user_id,
    now(),
    'server',
    gen_random_uuid(),
    now()
  )
  on conflict (user_id, fazenda_id) do update
    set role = excluded.role,
        is_primary = excluded.is_primary,
        invited_by = excluded.invited_by,
        accepted_at = excluded.accepted_at,
        deleted_at = null,
        updated_at = now();

  -- 3) UPSERT active farm
  insert into public.user_settings (user_id, active_fazenda_id)
  values (_user_id, _fazenda_id)
  on conflict (user_id) do update
    set active_fazenda_id = excluded.active_fazenda_id,
        deleted_at = null,
        updated_at = now();

  -- 4) (Opcional) Desarmar bootstrap depois da 1ª criação
  -- update public.user_profiles
  -- set can_create_farm = false, updated_at = now()
  -- where user_id = _user_id;

  return _fazenda_id;
end;
$$;

grant execute on function public.create_fazenda(text, text, text) to authenticated;
