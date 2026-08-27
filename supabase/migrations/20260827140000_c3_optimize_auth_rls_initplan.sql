-- Migration: C3 — Otimização auth_rls_initplan
-- Substitui chamadas auth.uid() avaliadas por linha por (select auth.uid())
-- para permitir ao planejador do Postgres construir um InitPlan de avaliação única por query.
-- Preserva estritamente a matriz de autorização e contratos multi-tenant.

-- 1. app_superadmins: app_superadmins_select_self
ALTER POLICY "app_superadmins_select_self" ON public.app_superadmins
  USING (user_id = (select auth.uid()));

-- 2. eventos_ecc: user_fazenda_access
ALTER POLICY "user_fazenda_access" ON public.eventos_ecc
  USING ((select auth.uid()) = ANY (SELECT user_id FROM public.user_fazendas WHERE fazenda_id = eventos_ecc.fazenda_id));

-- 3. fazendas: fazendas_insert_auth
ALTER POLICY "fazendas_insert_auth" ON public.fazendas
  WITH CHECK (created_by = (select auth.uid()));

-- 4. user_fazendas: user_fazendas_select_member
ALTER POLICY "user_fazendas_select_member" ON public.user_fazendas
  USING ((user_id = (select auth.uid())) OR has_membership(fazenda_id));

-- 5. user_profiles: user_profiles_insert_self
ALTER POLICY "user_profiles_insert_self" ON public.user_profiles
  WITH CHECK (user_id = (select auth.uid()));

-- 6. user_profiles: user_profiles_select_related
ALTER POLICY "user_profiles_select_related" ON public.user_profiles
  USING (
    (user_id = (select auth.uid()))
    OR (
      EXISTS (
        SELECT 1
        FROM public.user_fazendas a
        JOIN public.user_fazendas b ON b.fazenda_id = a.fazenda_id AND b.user_id = (select auth.uid()) AND b.deleted_at IS NULL
        WHERE a.user_id = user_profiles.user_id AND a.deleted_at IS NULL
      )
    )
  );

-- 7. user_profiles: user_profiles_update_self
ALTER POLICY "user_profiles_update_self" ON public.user_profiles
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- 8. user_settings: user_settings_self
ALTER POLICY "user_settings_self" ON public.user_settings
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
