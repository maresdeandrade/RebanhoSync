-- 0003_create_fazenda_rpc.sql
-- =========================================================
-- RPC create_fazenda: cria fazenda + membership owner + seta active_fazenda_id
-- (com UPSERT em user_settings)
-- =========================================================

create or replace function public.create_fazenda(
  _nome text,
  _codigo text default null,
  _municipio text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _fazenda_id uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- 1) Criar fazenda
  insert into public.fazendas (
    nome,
    codigo,
    municipio,
    created_by,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at,
    server_received_at,
    deleted_at
  )
  values (
    _nome,
    _codigo,
    _municipio,
    _user_id,
    'server',
    gen_random_uuid(),
    null,
    now(),
    now(),
    null
  )
  returning id into _fazenda_id;

  -- 2) Criar membership (owner)
  insert into public.user_fazendas (
    user_id,
    fazenda_id,
    role,
    is_primary,
    invited_by,
    accepted_at,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at,
    server_received_at,
    deleted_at
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
    null,
    now(),
    now(),
    null
  )
  on conflict (user_id, fazenda_id) do update
    set role = excluded.role,
        is_primary = excluded.is_primary,
        invited_by = excluded.invited_by,
        accepted_at = excluded.accepted_at,
        deleted_at = null,
        updated_at = now();

  -- 3) UPSERT active_fazenda_id em user_settings (corrige timing trigger/RPC)
  insert into public.user_settings (user_id, active_fazenda_id)
  values (_user_id, _fazenda_id)
  on conflict (user_id) do update
    set active_fazenda_id = excluded.active_fazenda_id,
        deleted_at = null,
        updated_at = now();

  return _fazenda_id;
end;
$$;

grant execute on function public.create_fazenda(text, text, text) to authenticated;
