-- 0008_fix_invite_preview.sql
-- =========================================================
-- Fix: get_invite_preview return type mismatch
-- Bug: RPC returns TABLE (array), frontend expects JSON object with is_valid
-- Impact: All invites show as "expired" immediately
-- Solution: Change return type to JSON with is_valid field
-- =========================================================

set search_path = public;

-- Drop existing function
drop function if exists public.get_invite_preview(uuid);

-- Recreate with correct return type and is_valid field
create or replace function public.get_invite_preview(_token uuid)
returns json
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  _invite_data record;
begin
  -- Fetch invite data
  select
    fi.fazenda_id,
    f.nome as fazenda_nome,
    fi.role,
    coalesce(up.display_name, 'Convite') as inviter_nome,
    fi.status,
    fi.expires_at,
    (fi.status = 'pending' and fi.expires_at > now()) as is_valid
  into _invite_data
  from public.farm_invites fi
  join public.fazendas f on f.id = fi.fazenda_id
  left join public.user_profiles up on up.user_id = fi.invited_by
  where fi.token = _token
    and fi.deleted_at is null;

  -- Return null if not found (let frontend handle)
  if not found then
    return null;
  end if;

  -- Return as JSON object
  return json_build_object(
    'fazenda_id', _invite_data.fazenda_id,
    'fazenda_nome', _invite_data.fazenda_nome,
    'role', _invite_data.role,
    'inviter_nome', _invite_data.inviter_nome,
    'status', _invite_data.status,
    'expires_at', _invite_data.expires_at,
    'is_valid', _invite_data.is_valid
  );
end;
$$;

-- Grant access
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

-- Validation comment
comment on function public.get_invite_preview is 
'Returns invite preview as JSON object with is_valid field. 
Returns null if invite not found.
is_valid = (status=pending AND expires_at > now())';
