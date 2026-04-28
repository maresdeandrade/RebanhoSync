-- 0005_member_management_rpcs.sql
-- =========================================================
-- Member Management: RPCs para owner/manager gerenciar membros
-- - Sem INSERT/UPDATE/DELETE direto via client (apenas RPCs)
-- - Protege: não remover último owner; manager não altera owner
-- =========================================================

-- =========================================================
-- RPC: admin_set_member_role
-- Propósito: Trocar role de um membro na fazenda
-- Permissão:
--   - owner: pode tudo (inclui promover/rebaixar owner, exceto "último owner")
--   - manager: pode alterar roles NÃO-owner (não mexe em owner)
-- =========================================================
create or replace function public.admin_set_member_role(
  _fazenda_id uuid,
  _target_user_id uuid,
  _new_role public.farm_role_enum
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  _caller_id uuid;
  _caller_role public.farm_role_enum;
  _current_role public.farm_role_enum;
  _owner_count int;
begin
  _caller_id := auth.uid();
  if _caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1) Validar caller é membro ativo e role permite gerenciar
  select uf.role
    into _caller_role
  from public.user_fazendas uf
  where uf.user_id = _caller_id
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null;

  if _caller_role is null then
    raise exception 'Forbidden - not a member of this farm';
  end if;

  if _caller_role not in ('owner', 'manager') then
    raise exception 'Forbidden - only owner/manager can manage members';
  end if;

  -- 2) Validar target existe e está ativo
  select uf.role
    into _current_role
  from public.user_fazendas uf
  where uf.user_id = _target_user_id
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null;

  if _current_role is null then
    raise exception 'Target user not found in this farm';
  end if;

  -- P0: Manager NÃO pode alterar role de um owner (nem rebaixar)
  if _current_role = 'owner' and _caller_role <> 'owner' then
    raise exception 'Only owner can change role of an owner';
  end if;

  -- 3) Apenas owner pode promover para owner
  if _new_role = 'owner' and _caller_role <> 'owner' then
    raise exception 'Only owner can promote to owner';
  end if;

  -- 4) Prevenir rebaixar o último owner
  if _current_role = 'owner' and _new_role <> 'owner' then
    select count(*) into _owner_count
    from public.user_fazendas uf
    where uf.fazenda_id = _fazenda_id
      and uf.role = 'owner'
      and uf.deleted_at is null;

    if _owner_count = 1 then
      raise exception 'Cannot demote the last owner';
    end if;
  end if;

  -- 5) Atualizar role (apenas se ativo)
  update public.user_fazendas
  set role = _new_role,
      updated_at = now()
  where user_id = _target_user_id
    and fazenda_id = _fazenda_id
    and deleted_at is null;

  if not found then
    raise exception 'Target user not found or inactive';
  end if;
end;
$$;

grant execute on function public.admin_set_member_role(uuid, uuid, public.farm_role_enum) to authenticated;

-- =========================================================
-- RPC: admin_remove_member
-- Propósito: Remover membro da fazenda (soft delete)
-- Permissão: owner only
-- Protege: não remove último owner
-- =========================================================
create or replace function public.admin_remove_member(
  _fazenda_id uuid,
  _target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  _caller_id uuid;
  _caller_role public.farm_role_enum;
  _target_role public.farm_role_enum;
  _owner_count int;
begin
  _caller_id := auth.uid();
  if _caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1) Apenas owner pode remover membros
  select uf.role
    into _caller_role
  from public.user_fazendas uf
  where uf.user_id = _caller_id
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null;

  if _caller_role is null then
    raise exception 'Forbidden - not a member of this farm';
  end if;

  if _caller_role <> 'owner' then
    raise exception 'Forbidden - only owner can remove members';
  end if;

  -- 2) Validar que target existe e está ativo
  select uf.role
    into _target_role
  from public.user_fazendas uf
  where uf.user_id = _target_user_id
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null;

  if _target_role is null then
    raise exception 'Target user not found in this farm';
  end if;

  -- 3) Prevenir remover o último owner
  if _target_role = 'owner' then
    select count(*) into _owner_count
    from public.user_fazendas uf
    where uf.fazenda_id = _fazenda_id
      and uf.role = 'owner'
      and uf.deleted_at is null;

    if _owner_count = 1 then
      raise exception 'Cannot remove the last owner';
    end if;
  end if;

  -- 4) Soft delete (apenas se ativo)
  update public.user_fazendas
  set deleted_at = now(),
      updated_at = now()
  where user_id = _target_user_id
    and fazenda_id = _fazenda_id
    and deleted_at is null;

  if not found then
    raise exception 'Target user not found or already removed';
  end if;
end;
$$;

grant execute on function public.admin_remove_member(uuid, uuid) to authenticated;

-- =========================================================
-- RLS: Atualizar SELECT em user_fazendas
-- Permitir ver membros das fazendas onde o usuário pertence
-- (e esconder linhas soft-deleted)
-- =========================================================
drop policy if exists user_fazendas_select_members on public.user_fazendas;

create policy user_fazendas_select_members
on public.user_fazendas
for select
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or fazenda_id in (
      select uf2.fazenda_id
      from public.user_fazendas uf2
      where uf2.user_id = auth.uid()
        and uf2.deleted_at is null
    )
  )
);
