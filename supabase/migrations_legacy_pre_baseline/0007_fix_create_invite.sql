-- 0007_fix_create_invite.sql
-- =========================================================
-- Fix: recreate public.create_invite with updated return type (json)
-- Why: Postgres does NOT allow changing return type via CREATE OR REPLACE
-- when function already exists. We must DROP the existing overload(s) first.
-- =========================================================

-- Safety: ensure predictable schema resolution
set search_path = public;

-- =========================================================
-- 1) Drop ALL existing overloads of public.create_invite(...)
-- =========================================================
do $$
declare r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_invite'
  loop
    execute format('drop function if exists public.create_invite(%s);', r.args);
  end loop;
end $$;

-- =========================================================
-- 2) Recreate function with the new signature and return type
--    RETURNS json
-- =========================================================
create or replace function public.create_invite(
  _fazenda_id uuid,
  _email text,
  _phone text,
  _role public.farm_role_enum
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  _caller_id uuid;
  _caller_role public.farm_role_enum;
  _new_invite_id uuid;
  _new_token uuid;
  _expires_at timestamptz;
  _normalized_email text;
  _normalized_phone text;
begin
  _caller_id := auth.uid();
  if _caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Normalize inputs (treat empty strings as null)
  _normalized_email := nullif(lower(trim(_email)), '');
  _normalized_phone := nullif(trim(_phone), '');

  -- At least one contact required
  if _normalized_email is null and _normalized_phone is null then
    raise exception 'Email or phone required';
  end if;

  -- 1) Caller must be owner or manager in the farm
  select uf.role into _caller_role
  from public.user_fazendas uf
  where uf.user_id = _caller_id
    and uf.fazenda_id = _fazenda_id
    and uf.deleted_at is null;

  if _caller_role not in ('owner', 'manager') then
    raise exception 'Forbidden - only owner/manager can invite';
  end if;

  -- 2) Check if email already a member
  if _normalized_email is not null then
    if exists (
      select 1
      from public.user_fazendas uf
      join auth.users u on u.id = uf.user_id
      where uf.fazenda_id = _fazenda_id
        and uf.deleted_at is null
        and lower(u.email) = _normalized_email
    ) then
      raise exception 'User already a member of this farm';
    end if;
  end if;

  -- 3) Check if phone already a member
  if _normalized_phone is not null then
    if exists (
      select 1
      from public.user_fazendas uf
      join public.user_profiles up on up.user_id = uf.user_id
      where uf.fazenda_id = _fazenda_id
        and uf.deleted_at is null
        and up.phone = _normalized_phone
    ) then
      raise exception 'User already a member of this farm';
    end if;
  end if;

  -- 4) Create invite (unique indexes prevent duplicate pending invites)
  _new_invite_id := gen_random_uuid();
  _new_token := gen_random_uuid();
  _expires_at := now() + interval '7 days';

  insert into public.farm_invites (
    id, fazenda_id, invited_by, email, phone, role, token, expires_at
  ) values (
    _new_invite_id,
    _fazenda_id,
    _caller_id,
    _normalized_email,
    _normalized_phone,
    _role,
    _new_token,
    _expires_at
  );

  return json_build_object(
    'invite_id', _new_invite_id,
    'token', _new_token,
    'expires_at', _expires_at
  );
end;
$$;

grant execute on function public.create_invite(uuid, text, text, public.farm_role_enum) to authenticated;
