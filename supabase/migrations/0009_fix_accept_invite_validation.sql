-- 0009_fix_accept_invite_validation.sql
-- =========================================================
-- Fix: accept_invite identity validation too strict
-- Bug: Requires BOTH email AND phone to match when both present in invite
-- Issue: User may not have phone in profile yet
-- Solution: Make phone validation optional - only validate if user HAS phone
-- =========================================================

set search_path = public;

-- Drop and recreate accept_invite with fixed validation logic
drop function if exists public.accept_invite(uuid);

create or replace function public.accept_invite(_token uuid)
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

  -- Lock invite (prevent race condition)
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

  -- Get user's email from JWT
  _jwt_email := lower(nullif(auth.jwt() ->> 'email', ''));

  -- ✅ FIX: Validate email if present in invite
  if _invite_email is not null then
    if _jwt_email is null or _jwt_email <> lower(_invite_email) then
      raise exception 'Email does not match invite';
    end if;
  end if;

  -- ✅ FIX: Validate phone ONLY if user has phone in profile
  if _invite_phone is not null then
    select public.normalize_phone(up.phone)
      into _profile_phone
    from public.user_profiles up
    where up.user_id = _user_id;

    -- Only reject if user HAS phone and it doesn't match
    if _profile_phone is not null then
      if _profile_phone <> public.normalize_phone(_invite_phone) then
        raise exception 'Phone does not match invite';
      end if;
    end if;
    -- If user doesn't have phone yet, allow (they can add it later)
  end if;

  -- Check if already a member
  if exists (
    select 1
    from public.user_fazendas uf
    where uf.user_id = _user_id
      and uf.fazenda_id = _fazenda_id
      and uf.deleted_at is null
  ) then
    raise exception 'Already a member of this farm';
  end if;

  -- is_primary: true if no active memberships
  select count(*) into _active_memberships
  from public.user_fazendas uf
  where uf.user_id = _user_id
    and uf.deleted_at is null;

  _is_primary := (_active_memberships = 0);

  -- Create membership
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

  -- Mark invite as accepted
  update public.farm_invites
  set status = 'accepted',
      updated_at = now()
  where id = _invite_id;

  -- Set active_fazenda_id if empty (UPSERT)
  insert into public.user_settings (user_id, active_fazenda_id)
  values (_user_id, _fazenda_id)
  on conflict (user_id) do update
    set active_fazenda_id = coalesce(public.user_settings.active_fazenda_id, excluded.active_fazenda_id),
        updated_at = now();

  return _fazenda_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

comment on function public.accept_invite is 
'Accept farm invite. Validates email if present. Validates phone only if user has phone in profile.';
