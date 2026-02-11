-- DEBUG QUERIES FOR ONBOARDING ISSUES
-- Execute these in Supabase SQL Editor while logged in as the test user

-- =====================================================
-- SCENARIO 2 DEBUG: Why is "Create Farm" button not showing?
-- =====================================================

-- 1. Check if user has can_create_farm flag
SELECT user_id, can_create_farm, display_name, phone
FROM public.user_profiles
WHERE user_id = auth.uid();


-- Expected: can_create_farm should be TRUE if you set it

-- 2. Test can_create_farm() function directly
SELECT public.can_create_farm() as can_create;

-- Expected: Should return TRUE
-- If FALSE, check why...

-- 3. Check if user is owner of any farm
SELECT uf.user_id, uf.fazenda_id, uf.role, f.nome as fazenda_nome
FROM public.user_fazendas uf
JOIN public.fazendas f ON f.id = uf.fazenda_id
WHERE uf.user_id = auth.uid()
  AND uf.deleted_at IS NULL;

-- Expected: Should show farms where user is member

-- =====================================================
-- SCENARIO 3 DEBUG: Why doesn't new user see farm after accepting invite?
-- =====================================================

-- 4. After accepting invite, check membership was created
SELECT uf.user_id, uf.fazenda_id, uf.role, uf.accepted_at, f.nome
FROM public.user_fazendas uf
JOIN public.fazendas f ON f.id = uf.fazenda_id
WHERE uf.user_id = auth.uid()
  AND uf.deleted_at IS NULL;

-- Expected: Should show the farm from the accepted invite

-- 5. Check user_settings has active_fazenda_id
SELECT user_id, active_fazenda_id
FROM public.user_settings
WHERE user_id = auth.uid();

-- Expected: Should have active_fazenda_id set to the invited farm

-- 6. Check if RLS is blocking the farm visibility
SELECT id, nome, created_by
FROM public.fazendas
WHERE id IN (
  SELECT fazenda_id 
  FROM public.user_fazendas 
  WHERE user_id = auth.uid() 
    AND deleted_at IS NULL
);

-- Expected: Should return the farm(s) user has access to

-- =====================================================
-- SCENARIO 4 DEBUG: Why can't owner create second farm?
-- =====================================================

-- 7. Verify user is owner of at least one farm
SELECT 
  uf.user_id,
  uf.fazenda_id,
  uf.role,
  f.nome,
  public.can_create_farm() as can_create_farm_result
FROM public.user_fazendas uf
JOIN public.fazendas f ON f.id = uf.fazenda_id
WHERE uf.user_id = auth.uid()
  AND uf.role = 'owner'
  AND uf.deleted_at IS NULL;

-- Expected: 
-- - Should show at least one farm with role='owner'
-- - can_create_farm_result should be TRUE

-- 8. Check the can_create_farm function logic step by step
SELECT 
  EXISTS (
    SELECT 1
    FROM public.user_fazendas uf
    WHERE uf.user_id = auth.uid()
      AND uf.role = 'owner'
      AND uf.deleted_at IS NULL
  ) as is_owner_of_any_farm,
  (SELECT can_create_farm FROM public.user_profiles WHERE user_id = auth.uid()) as has_flag,
  public.can_create_farm() as final_result;

-- Expected: At least one of is_owner_of_any_farm or has_flag should be TRUE

-- =====================================================
-- MEMBERS LIST DEBUG: Why only seeing own user?
-- =====================================================

-- 9. Check all members of current active farm
-- First get your active farm
WITH active_farm AS (
  SELECT active_fazenda_id
  FROM public.user_settings
  WHERE user_id = auth.uid()
)
SELECT 
  uf.user_id,
  uf.role,
  up.display_name,
  up.phone,
  uf.accepted_at
FROM public.user_fazendas uf
JOIN public.user_profiles up ON up.user_id = uf.user_id
CROSS JOIN active_farm af
WHERE uf.fazenda_id = af.active_fazenda_id
  AND uf.deleted_at IS NULL
ORDER BY uf.created_at;

-- Expected: Should show ALL members of the farm


-- 10. Check RLS policy on user_fazendas
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_fazendas';

-- This will show all RLS policies on user_fazendas table

-- =====================================================
-- GENERAL DEBUG: Check complete state
-- =====================================================

-- 11. Complete user state check
SELECT 
  'Current User' as info,
  auth.uid() as user_id,
  (SELECT display_name FROM public.user_profiles WHERE user_id = auth.uid()) as display_name,
  (SELECT phone FROM public.user_profiles WHERE user_id = auth.uid()) as phone,
  (SELECT can_create_farm FROM public.user_profiles WHERE user_id = auth.uid()) as can_create_farm_flag,
  public.can_create_farm() as can_create_farm_function,
  (SELECT active_fazenda_id FROM public.user_settings WHERE user_id = auth.uid()) as active_farm,
  (SELECT COUNT(*) FROM public.user_fazendas WHERE user_id = auth.uid() AND deleted_at IS NULL) as farm_count,
  (SELECT COUNT(*) FROM public.user_fazendas WHERE user_id = auth.uid() AND role = 'owner' AND deleted_at IS NULL) as owner_count;

