-- 0006_invite_system.sql
-- =========================================================
-- Invite System (farm_invites) + RPCs security definer
-- =========================================================

-- ---------------------------------------------------------
-- 1) Enum: farm_invite_status_enum
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'farm_invite_status_enum'
  ) then
    create type public.farm_invite_status_enum as enum (
      'pending',
      'accepted',
      'rejected',
      'cancelled'
    );
  end if;
end $$;

-- ---------------------------------------------------------
-- 2) Helper: normalize_phone
-- (comparação defensiva de phone em convites/perfil)
-- ---------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    else nullif(regexp_replace(trim(p), '[^0-9+]', '', 'g'), '')
  end;
$$;

-- ---------------------------------------------------------
-- 3) Tabela: farm_invites
-- ---------------------------------------------------------
create table if not exists public.farm_invites (
  id uuid primary key default gen_random_uuid(),

  fazenda_id uuid not null references public.fazendas(id) on delete cascade,
  invited_by uuid not null references auth.users(id),

  -- contato: um dos dois é obrigatório
  email text,
  phone text,

  role public.farm_role_enum not null default 'cowboy',
  status public.farm_invite_status_enum not null default 'pending',

  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '7 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint farm_invites_contact_check
    check (email is not null or phone is not null)
);

-- Índices
create index if not exists idx_farm_invites_token
  on public.farm_invites(token);

create index if not exists idx_farm_invites_fazenda_active
  on public.farm_invites(fazenda_id)
  where deleted_at is null;

create index if not exists idx_farm_invites_status_active
  on public.farm_invites(status)
  where deleted_at is null;

-- Evitar duplicidade de convite pendente por email/phone
create unique index if not exists ux_farm_invites_pending_email
  on public.farm_invites (fazenda_id, lower(email))
  where deleted_at is null
    and status = 'pending'
    and email is not null;

create unique index if not exists ux_farm_invites_pending_phone
  on public.farm_invites (fazenda_id, phone)
  where deleted_at is null
    and status = 'pending'
    and phone is not null;

-- ---------------------------------------------------------
-- 4) RLS farm_invites
-- ---------------------------------------------------------
alter table public.farm_invites enable row level security;

-- SELECT somente para owner/manager da fazenda
drop policy if exists farm_invites_select_manage on public.farm_invites;

create policy farm_invites_select_manage
on public.farm_invites
for select
using (
  public.role_in_fazenda(fazenda_id) in ('owner', 'manager')
);

-- Importante: sem policies de INSERT/UPDATE/DELETE
-- (writes apenas via RPC security definer)

-- ---------------------------------------------------------
-- 5) RPC: create_invite
-- owner/manager cria convite (link/token)
-- ---------------------------------------------------------
create or replace function public.create_invite(
  _fazenda_id uuid,
  _email text default null,
  _phone text default null,
  _role public.farm_role_enum default 'cowboy'
)
returns table (
  invite_id uuid,
  token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _caller_id uuid;
  _caller_role public.farm_role_enum;
  _email_norm text;
  _phone_norm text;
  _existing_user_id uuid;
begin
  _caller_id := auth.uid();
  if _caller_id is null then
    raise exception 'Not authenticated';
  end if;

  _caller_role := public.role_in_fazenda(_fazenda_id);
  if _caller_role not in ('owner', 'manager') then
    raise exception 'Forbidden - only owner/manager can invite';
  end if;

  -- manager não pode convidar owner
  if _role = 'owner' and _caller_role <> 'owner' then
    raise exception 'Forbidden - only owner can invite/promote owner';
  end if;

  _email_norm := nullif(lower(trim(_email)), '');
  _phone_norm := public.normalize_phone(_phone);

  if _email_norm is null and _phone_norm is null then
    raise exception 'Validation - email or phone is required';
  end if;

  -- já é membro? (por email)
  if _email_norm is not null then
    select u.id
      into _existing_user_id
    from auth.users u
    where lower(u.email) = _email_norm
    limit 1;

    if _existing_user_id is not null then
      if exists (
        select 1
        from public.user_fazendas uf
        where uf.user_id = _existing_user_id
          and uf.fazenda_id = _fazenda_id
          and uf.deleted_at is null
      ) then
        raise exception 'Already a member of this farm (email)';
      end if;
    end if;
  end if;

  -- já é membro? (por phone)
  if _phone_norm is not null then
    select up.user_id
      into _existing_user_id
    from public.user_profiles up
    where public.normalize_phone(up.phone) = _phone_norm
    limit 1;

    if _existing_user_id is not null then
      if exists (
        select 1
        from public.user_fazendas uf
        where uf.user_id = _existing_user_id
          and uf.fazenda_id = _fazenda_id
          and uf.deleted_at is null
      ) then
        raise exception 'Already a member of this farm (phone)';
      end if;
    end if;
  end if;

  -- cria convite (unique parcial impede duplicado pending)
  insert into public.farm_invites (
    fazenda_id,
    invited_by,
    email,
    phone,
    role,
    status,
    expires_at,
    updated_at
  ) values (
    _fazenda_id,
    _caller_id,
    _email_norm,
    _phone_norm,
    _role,
    'pending',
    now() + interval '7 days',
    now()
  )
  returning id, public.farm_invites.token, public.farm_invites.expires_at
  into invite_id, token, expires_at;

  return next;
end;
$$;

grant execute on function public.create_invite(uuid, text, text, public.farm_role_enum) to authenticated;

-- ---------------------------------------------------------
-- 6) RPC: cancel_invite
-- owner/manager cancela convite pendente
-- ---------------------------------------------------------
create or replace function public.cancel_invite(
  _invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _caller_id uuid;
  _caller_role public.farm_role_enum;
  _fazenda_id uuid;
  _status public.farm_invite_status_enum;
begin
  _caller_id := auth.uid();
  if _caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select fi.fazenda_id, fi.status
    into _fazenda_id, _status
  from public.farm_invites fi
  where fi.id = _invite_id
    and fi.deleted_at is null;

  if _fazenda_id is null then
    raise exception 'Invite not found';
  end if;

  _caller_role := public.role_in_fazenda(_fazenda_id);
  if _caller_role not in ('owner', 'manager') then
    raise exception 'Forbidden - only owner/manager can cancel invites';
  end if;

  if _status <> 'pending' then
    raise exception 'Only pending invites can be cancelled';
  end if;

  update public.farm_invites
  set status = 'cancelled',
      deleted_at = now(),
      updated_at = now()
  where id = _invite_id;
end;
$$;

grant execute on function public.cancel_invite(uuid) to authenticated;

-- ---------------------------------------------------------
-- 7) RPC: get_invite_preview
-- Preview por token (pode ser anon ou authenticated)
-- ---------------------------------------------------------
create or replace function public.get_invite_preview(
  _token uuid
)
returns table (
  fazenda_id uuid,
  fazenda_nome text,
  role public.farm_role_enum,
  inviter_display_name text,
  status public.farm_invite_status_enum,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return query
  select
    fi.fazenda_id,
    f.nome as fazenda_nome,
    fi.role,
    coalesce(up.display_name, 'Convite') as inviter_display_name,
    fi.status,
    fi.expires_at
  from public.farm_invites fi
  join public.fazendas f on f.id = fi.fazenda_id
  left join public.user_profiles up on up.user_id = fi.invited_by
  where fi.token = _token
    and fi.deleted_at is null;
end;
$$;

-- Permitir preview para usuários não autenticados (link com token)
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- 8) RPC: accept_invite
-- Usuário autenticado aceita convite (cria membership)
-- Protege: identidade (email/phone) deve bater com convite
-- ---------------------------------------------------------
create or replace function public.accept_invite(
  _token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _user_id uuid;
  _jwt_email text;
  _profile_phone text;

  _invite_id uuid;
  _fazenda_id uuid;
  _invite_email text;
  _invite_phone text;
  _invite_role public.farm_role_enum;
  _invite_status public.farm_invite_status_enum;
  _expires_at timestamptz;

  _is_primary boolean;
  _active_memberships int;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- lock do convite (evitar corrida)
  select fi.id, fi.fazenda_id, fi.email, fi.phone, fi.role, fi.status, fi.expires_at
    into _invite_id, _fazenda_id, _invite_email, _invite_phone, _invite_role, _invite_status, _expires_at
  from public.farm_invites fi
  where fi.token = _token
    and fi.deleted_at is null
  for update;

  if _invite_id is null then
    raise exception 'Invite not found';
  end if;

  if _invite_status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if _expires_at < now() then
    raise exception 'Invite expired';
  end if;

  -- identidade: email via jwt (Supabase)
  _jwt_email := lower(nullif(auth.jwt() ->> 'email', ''));

  if _invite_email is not null then
    if _jwt_email is null or _jwt_email <> lower(_invite_email) then
      raise exception 'Forbidden - this invite email does not match your account';
    end if;
  end if;

  if _invite_phone is not null then
    select public.normalize_phone(up.phone)
      into _profile_phone
    from public.user_profiles up
    where up.user_id = _user_id;

    if _profile_phone is null or _profile_phone <> public.normalize_phone(_invite_phone) then
      raise exception 'Forbidden - this invite phone does not match your profile';
    end if;
  end if;

  -- já é membro?
  if exists (
    select 1
    from public.user_fazendas uf
    where uf.user_id = _user_id
      and uf.fazenda_id = _fazenda_id
      and uf.deleted_at is null
  ) then
    raise exception 'Already a member of this farm';
  end if;

  -- is_primary: true se não tiver memberships ativos
  select count(*) into _active_memberships
  from public.user_fazendas uf
  where uf.user_id = _user_id
    and uf.deleted_at is null;

  _is_primary := (_active_memberships = 0);

  -- criar membership (server-side)
  insert into public.user_fazendas (
    user_id,
    fazenda_id,
    role,
    is_primary,
    invited_by,
    accepted_at,
    client_id,
    client_op_id
  ) values (
    _user_id,
    _fazenda_id,
    _invite_role,
    _is_primary,
    (select invited_by from public.farm_invites where id = _invite_id),
    now(),
    'server',
    gen_random_uuid()
  );

  -- marcar convite como aceito
  update public.farm_invites
  set status = 'accepted',
      updated_at = now()
  where id = _invite_id;

  -- setar active_fazenda_id se vazio (UPSERT)
  insert into public.user_settings (user_id, active_fazenda_id)
  values (_user_id, _fazenda_id)
  on conflict (user_id) do update
    set active_fazenda_id = coalesce(public.user_settings.active_fazenda_id, excluded.active_fazenda_id),
        updated_at = now();

  return _fazenda_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------
-- 9) RPC: reject_invite
-- Usuário autenticado rejeita convite
-- (mantém mesma validação de identidade para evitar abuso)
-- ---------------------------------------------------------
create or replace function public.reject_invite(
  _token uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _user_id uuid;
  _jwt_email text;
  _profile_phone text;

  _invite_id uuid;
  _invite_email text;
  _invite_phone text;
  _status public.farm_invite_status_enum;
  _expires_at timestamptz;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fi.id, fi.email, fi.phone, fi.status, fi.expires_at
    into _invite_id, _invite_email, _invite_phone, _status, _expires_at
  from public.farm_invites fi
  where fi.token = _token
    and fi.deleted_at is null
  for update;

  if _invite_id is null then
    raise exception 'Invite not found';
  end if;

  if _status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if _expires_at < now() then
    raise exception 'Invite expired';
  end if;

  _jwt_email := lower(nullif(auth.jwt() ->> 'email', ''));

  if _invite_email is not null then
    if _jwt_email is null or _jwt_email <> lower(_invite_email) then
      raise exception 'Forbidden - this invite email does not match your account';
    end if;
  end if;

  if _invite_phone is not null then
    select public.normalize_phone(up.phone)
      into _profile_phone
    from public.user_profiles up
    where up.user_id = _user_id;

    if _profile_phone is null or _profile_phone <> public.normalize_phone(_invite_phone) then
      raise exception 'Forbidden - this invite phone does not match your profile';
    end if;
  end if;

  update public.farm_invites
  set status = 'rejected',
      updated_at = now()
  where id = _invite_id;
end;
$$;

grant execute on function public.reject_invite(uuid) to authenticated;

-- ---------------------------------------------------------
-- 10) (Opcional) RPC: update_my_profile
-- Se você preferir padronizar update via RPC em vez de UPDATE direto
-- ---------------------------------------------------------
create or replace function public.update_my_profile(
  _display_name text,
  _phone text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _user_id uuid;
begin
  _user_id := auth.uid();
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_profiles
  set display_name = nullif(trim(_display_name), ''),
      phone = public.normalize_phone(_phone),
      updated_at = now()
  where user_id = _user_id;
end;
$$;

grant execute on function public.update_my_profile(text, text) to authenticated;
