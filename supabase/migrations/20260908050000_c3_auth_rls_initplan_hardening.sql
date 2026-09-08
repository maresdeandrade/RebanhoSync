-- C3.1 — Incremental RLS InitPlan Hardening
-- Hardening of 8 auth_rls_initplan findings: auth.uid() -> (select auth.uid())
-- Preserves permissions, commands, roles, joins, filters, and domain logic exactly.

-- 1. public.fazendas -> fazendas_insert_auth (INSERT, {public})
ALTER POLICY "fazendas_insert_auth" ON "public"."fazendas"
  WITH CHECK (created_by = (SELECT auth.uid()));

-- 2. public.user_profiles -> user_profiles_select_related (SELECT, {public})
ALTER POLICY "user_profiles_select_related" ON "public"."user_profiles"
  USING (
    (user_id = (SELECT auth.uid()))
    OR
    (EXISTS (
      SELECT 1
      FROM user_fazendas a
      JOIN user_fazendas b ON (
        b.fazenda_id = a.fazenda_id
        AND b.user_id = (SELECT auth.uid())
        AND b.deleted_at IS NULL
      )
      WHERE a.user_id = user_profiles.user_id
        AND a.deleted_at IS NULL
    ))
  );

-- 3. public.user_profiles -> user_profiles_insert_self (INSERT, {public})
ALTER POLICY "user_profiles_insert_self" ON "public"."user_profiles"
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 4. public.user_profiles -> user_profiles_update_self (UPDATE, {public})
ALTER POLICY "user_profiles_update_self" ON "public"."user_profiles"
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. public.user_settings -> user_settings_self (ALL, {public})
ALTER POLICY "user_settings_self" ON "public"."user_settings"
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 6. public.user_fazendas -> user_fazendas_select_member (SELECT, {public})
ALTER POLICY "user_fazendas_select_member" ON "public"."user_fazendas"
  USING (
    (user_id = (SELECT auth.uid()))
    OR
    has_membership(fazenda_id)
  );

-- 7. public.app_superadmins -> app_superadmins_select_self (SELECT, {authenticated})
ALTER POLICY "app_superadmins_select_self" ON "public"."app_superadmins"
  USING (user_id = (SELECT auth.uid()));

-- 8. public.eventos_ecc -> user_fazenda_access (ALL, {public})
ALTER POLICY "user_fazenda_access" ON "public"."eventos_ecc"
  USING (
    (SELECT auth.uid()) IN (
      SELECT uf.user_id
      FROM user_fazendas uf
      WHERE uf.fazenda_id = eventos_ecc.fazenda_id
        AND uf.deleted_at IS NULL
    )
  );
