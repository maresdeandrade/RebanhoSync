-- Migration: C4 — Normalização de multiple_permissive_policies (Lote Inicial: contrapartes)
-- Divide a política contrapartes_write_manager (FOR ALL) em políticas específicas de INSERT, UPDATE e DELETE.
-- Elimina a sobreposição redundante no comando SELECT mantendo rigorosamente a mesma regra de autorização:
-- - SELECT: apenas contrapartes_select_member (membros da fazenda)
-- - INSERT/UPDATE/DELETE: owner ou manager da fazenda via role_in_fazenda()

-- 1. Remover policy FOR ALL redundante
DROP POLICY IF EXISTS "contrapartes_write_manager" ON public.contrapartes;

-- 2. Garantir role authenticated explícito em contrapartes_select_member
ALTER POLICY "contrapartes_select_member" ON public.contrapartes TO authenticated;

-- 3. Criar policies de escrita segregadas por operação
CREATE POLICY "contrapartes_insert_manager" ON public.contrapartes
  FOR INSERT
  TO authenticated
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "contrapartes_update_manager" ON public.contrapartes
  FOR UPDATE
  TO authenticated
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "contrapartes_delete_manager" ON public.contrapartes
  FOR DELETE
  TO authenticated
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));
