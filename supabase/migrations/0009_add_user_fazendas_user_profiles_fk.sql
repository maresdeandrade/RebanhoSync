-- 0009_add_user_fazendas_user_profiles_fk.sql
-- =========================================================
-- Fix: Add foreign key relationship between user_fazendas and user_profiles
-- Why: Supabase requires explicit foreign key for joins using !inner syntax
-- Impact: Enables AdminMembros page to fetch member profiles correctly
-- =========================================================

-- Add foreign key from user_fazendas.user_id to user_profiles.user_id
-- This allows Supabase to automatically detect the relationship for joins
alter table public.user_fazendas
  add constraint fk_user_fazendas_user_profiles
  foreign key (user_id)
  references public.user_profiles(user_id)
  on delete cascade;
