-- 0012_lock_can_create_farm_column.sql
-- =========================================================
-- P0 Security: Prevent privilege escalation via can_create_farm
-- Users can update their profile but CANNOT modify can_create_farm
-- Only admin (SQL as postgres) can set bootstrap flag
-- =========================================================

-- Helper function to read current can_create_farm value
-- Used in WITH CHECK to prevent self-modification
create or replace function public.my_can_create_farm()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select up.can_create_farm
     from public.user_profiles up
     where up.user_id = auth.uid()
     limit 1),
    false
  );
$$;

grant execute on function public.my_can_create_farm() to authenticated;

-- Recreate user_profiles policy to allow self-updates
-- BUT enforce can_create_farm remains unchanged
drop policy if exists user_profiles_self on public.user_profiles;

create policy user_profiles_self
on public.user_profiles
for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and can_create_farm = public.my_can_create_farm()
);

-- ✅ Result: 
-- - Users CAN update display_name, phone, avatar, etc.
-- - Users CANNOT change can_create_farm (new value must equal current value)
-- - Bootstrap still possible via SQL as postgres/admin (bypasses RLS)
