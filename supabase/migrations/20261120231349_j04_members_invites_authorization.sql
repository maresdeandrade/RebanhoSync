-- One farm-row lock serializes every membership writer, including acceptance.
-- REST preview remains a TABLE/array; fazenda_id is an additive JSON field.
drop function public.get_invite_preview(uuid);
create function public.get_invite_preview(_token uuid)
returns table(fazenda_id uuid, fazenda_nome text, role public.farm_role_enum,
  inviter_nome text, expires_at timestamptz, status public.farm_invite_status_enum, is_valid boolean)
language sql stable security definer set search_path = public
as $$
  select f.id, f.nome, i.role, coalesce(up.display_name, 'Usuario'), i.expires_at, i.status,
    i.status = 'pending' and i.expires_at > now() and i.deleted_at is null
  from public.farm_invites i join public.fazendas f on f.id = i.fazenda_id
  left join public.user_profiles up on up.user_id = i.invited_by
  where i.token = _token;
$$;
revoke all on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

create or replace function public.admin_set_member_role(_fazenda_id uuid, _target_user_id uuid, _new_role public.farm_role_enum)
returns void language plpgsql security definer set search_path = public
as $$
declare v_target public.user_fazendas%rowtype; v_owner boolean;
begin
  perform 1 from public.fazendas where id = _fazenda_id for update;
  if not found or not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  v_owner := public.role_in_fazenda(_fazenda_id, array['owner']::public.farm_role_enum[]);
  select * into v_target from public.user_fazendas where fazenda_id = _fazenda_id and user_id = _target_user_id and deleted_at is null;
  if not found then raise exception 'Membro nao encontrado.'; end if;
  if _new_role is null then raise exception 'Papel obrigatorio.'; end if;
  if not v_owner and (v_target.role = 'owner' or _new_role = 'owner') then raise exception 'Somente proprietario pode administrar proprietario.'; end if;
  if v_target.role = _new_role then return; end if;
  if v_target.role = 'owner' and (select count(*) from public.user_fazendas where fazenda_id = _fazenda_id and role = 'owner' and deleted_at is null) <= 1 then
    raise exception 'Nao e permitido rebaixar o ultimo proprietario.';
  end if;
  update public.user_fazendas set role = _new_role, updated_at = now()
  where fazenda_id = _fazenda_id and user_id = _target_user_id and deleted_at is null;
end;
$$;

create or replace function public.admin_remove_member(_fazenda_id uuid, _target_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_target public.user_fazendas%rowtype;
begin
  perform 1 from public.fazendas where id = _fazenda_id for update;
  if not found or not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  select * into v_target from public.user_fazendas where fazenda_id = _fazenda_id and user_id = _target_user_id;
  if not found then raise exception 'Membro nao encontrado.'; end if;
  if v_target.role = 'owner' and not public.role_in_fazenda(_fazenda_id, array['owner']::public.farm_role_enum[]) then raise exception 'Somente proprietario pode remover proprietario.'; end if;
  if v_target.deleted_at is not null then return; end if;
  if v_target.role = 'owner' and (select count(*) from public.user_fazendas where fazenda_id = _fazenda_id and role = 'owner' and deleted_at is null) <= 1 then
    raise exception 'Nao e permitido remover o ultimo proprietario.';
  end if;
  update public.user_fazendas set deleted_at = now(), updated_at = now() where fazenda_id = _fazenda_id and user_id = _target_user_id;
end;
$$;

create or replace function public.create_invite(_fazenda_id uuid, _email text default null, _phone text default null, _role public.farm_role_enum default 'cowboy')
returns public.farm_invites language plpgsql security definer set search_path = public
as $$
declare v_invite public.farm_invites; v_email text := nullif(lower(btrim(_email)), ''); v_phone text := nullif(btrim(_phone), '');
begin
  perform 1 from public.fazendas where id = _fazenda_id for update;
  if not found or not public.role_in_fazenda(_fazenda_id, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  if _role = 'owner' and not public.role_in_fazenda(_fazenda_id, array['owner']::public.farm_role_enum[]) then raise exception 'Only owners can invite owners'; end if;
  if v_email is null and v_phone is null then raise exception 'Informe email ou telefone.'; end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Email invalido.'; end if;
  if v_phone is not null then
    if v_phone !~ '^[+0-9().[:space:]-]+$' then raise exception 'Telefone invalido.'; end if;
    v_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
    if length(v_phone) < 8 or length(v_phone) > 15 then raise exception 'Telefone invalido.'; end if;
  end if;
  insert into public.farm_invites(fazenda_id, invited_by, email, phone, role)
  values(_fazenda_id, auth.uid(), v_email, v_phone, _role) returning * into v_invite;
  return v_invite;
end;
$$;

create or replace function public.accept_invite(_token uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_invite public.farm_invites%rowtype;
  v_member public.user_fazendas%rowtype;
  v_user auth.users%rowtype;
  v_farm uuid;
begin
  if auth.uid() is null then raise exception 'Forbidden'; end if;
  select fazenda_id into v_farm from public.farm_invites where token = _token;
  if not found then raise exception 'Invite expired or invalid'; end if;
  perform 1 from public.fazendas where id = v_farm for update;
  select * into v_invite from public.farm_invites where token = _token for update;
  select * into v_user from auth.users where id = auth.uid();
  -- Auth identity only. Editable profile/user_metadata never proves identity.
  if v_invite.email is not null then
    if v_user.email_confirmed_at is null then raise exception 'Confirme o email no Supabase Auth.'; end if;
    if lower(btrim(v_user.email)) is distinct from lower(btrim(v_invite.email)) then raise exception 'Email does not match'; end if;
  else
    if v_user.phone_confirmed_at is null or nullif(v_user.phone, '') is null then raise exception 'Telefone deve estar verificado no Supabase Auth; telefone do perfil nao comprova identidade.'; end if;
    if regexp_replace(v_user.phone, '[^0-9]', '', 'g') is distinct from regexp_replace(v_invite.phone, '[^0-9]', '', 'g') then raise exception 'Phone does not match'; end if;
  end if;
  select * into v_member from public.user_fazendas where fazenda_id = v_farm and user_id = auth.uid();
  -- A successful replay is a no-op, never a replay of the old authorization.
  if v_invite.status = 'accepted' then
    if v_member.user_id is not null and v_member.deleted_at is null then return; end if;
    raise exception 'Convite ja utilizado. Solicite um novo convite.';
  end if;
  if v_invite.status <> 'pending' or v_invite.expires_at <= now() or v_invite.deleted_at is not null then raise exception 'Invite expired or invalid'; end if;
  if v_member.user_id is not null and v_member.deleted_at is null then raise exception 'Already a member'; end if;
  if v_member.deleted_at is not null and v_invite.created_at <= v_member.deleted_at then raise exception 'Acesso revogado. Solicite um novo convite.'; end if;
  if v_member.user_id is null then
    insert into public.user_fazendas(user_id, fazenda_id, role, accepted_at, invited_by)
    values(auth.uid(), v_farm, v_invite.role, now(), v_invite.invited_by);
  else
    update public.user_fazendas set role = v_invite.role, accepted_at = now(), invited_by = v_invite.invited_by, deleted_at = null, updated_at = now()
    where fazenda_id = v_farm and user_id = auth.uid();
  end if;
  update public.farm_invites set status = 'accepted', updated_at = now() where id = v_invite.id;
end;
$$;

create or replace function public.cancel_invite(_invite_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_farm uuid; v_status public.farm_invite_status_enum;
begin
  select fazenda_id into v_farm from public.farm_invites where id = _invite_id;
  perform 1 from public.fazendas where id = v_farm for update;
  if not found or not public.role_in_fazenda(v_farm, array['owner','manager']::public.farm_role_enum[]) then raise exception 'Forbidden'; end if;
  select status into v_status from public.farm_invites where id = _invite_id for update;
  if v_status = 'cancelled' then return; end if;
  if v_status <> 'pending' then raise exception 'Convite nao esta pendente.'; end if;
  update public.farm_invites set status = 'cancelled', deleted_at = now(), updated_at = now() where id = _invite_id;
end;
$$;

-- CREATE OR REPLACE keeps existing grants; explicitly retain the same boundary.
revoke all on function public.accept_invite(uuid), public.create_invite(uuid,text,text,public.farm_role_enum),
 public.admin_set_member_role(uuid,uuid,public.farm_role_enum), public.admin_remove_member(uuid,uuid), public.cancel_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid), public.create_invite(uuid,text,text,public.farm_role_enum),
 public.admin_set_member_role(uuid,uuid,public.farm_role_enum), public.admin_remove_member(uuid,uuid), public.cancel_invite(uuid) to authenticated;
