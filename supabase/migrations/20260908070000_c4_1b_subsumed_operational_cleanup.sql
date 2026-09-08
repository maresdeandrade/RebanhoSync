-- C4.1b — Subsumed Operational Cleanup (REDUNDANT_SUBSUMED)
-- Desmembramento de 14 policies 'FOR ALL' redundantes para SELECT em policies específicas de escrita:
-- 1. finance_transactions
-- 2. finance_categories
-- 3. lotes
-- 4. pastos
-- 5. pasto_ocupacoes
-- 6. insumos
-- 7. insumo_lotes
-- 8. insumo_apresentacoes
-- 9. contrapartes
-- 10. fazenda_sanidade_config
-- 11. protocolos_sanitarios
-- 12. protocolos_sanitarios_itens
-- 13. sociedade_animais
-- 14. sociedades_pecuarias
--
-- Preserva integralmente o predicado role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum])
-- e os papeis {public}.
-- Elimina a sobreposição em SELECT com as policies *_select_member existentes (baseadas em has_membership(fazenda_id)).

-- 1. finance_transactions
CREATE POLICY "finance_transactions_insert_manager" ON "public"."finance_transactions"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "finance_transactions_update_manager" ON "public"."finance_transactions"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "finance_transactions_delete_manager" ON "public"."finance_transactions"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "finance_transactions_write_manager" ON "public"."finance_transactions";

-- 2. finance_categories
CREATE POLICY "finance_categories_insert_manager" ON "public"."finance_categories"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "finance_categories_update_manager" ON "public"."finance_categories"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "finance_categories_delete_manager" ON "public"."finance_categories"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "finance_categories_write_manager" ON "public"."finance_categories";

-- 3. lotes
CREATE POLICY "lotes_insert_manager" ON "public"."lotes"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "lotes_update_manager" ON "public"."lotes"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "lotes_delete_manager" ON "public"."lotes"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "lotes_write_manager" ON "public"."lotes";

-- 4. pastos
CREATE POLICY "pastos_insert_manager" ON "public"."pastos"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "pastos_update_manager" ON "public"."pastos"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "pastos_delete_manager" ON "public"."pastos"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "pastos_write_manager" ON "public"."pastos";

-- 5. pasto_ocupacoes
CREATE POLICY "pasto_ocupacoes_insert_manager" ON "public"."pasto_ocupacoes"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "pasto_ocupacoes_update_manager" ON "public"."pasto_ocupacoes"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "pasto_ocupacoes_delete_manager" ON "public"."pasto_ocupacoes"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "pasto_ocupacoes_write_manager" ON "public"."pasto_ocupacoes";

-- 6. insumos
CREATE POLICY "insumos_insert_manager" ON "public"."insumos"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumos_update_manager" ON "public"."insumos"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumos_delete_manager" ON "public"."insumos"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "insumos_write_manager" ON "public"."insumos";

-- 7. insumo_lotes
CREATE POLICY "insumo_lotes_insert_manager" ON "public"."insumo_lotes"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumo_lotes_update_manager" ON "public"."insumo_lotes"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumo_lotes_delete_manager" ON "public"."insumo_lotes"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "insumo_lotes_write_manager" ON "public"."insumo_lotes";

-- 8. insumo_apresentacoes
CREATE POLICY "insumo_apresentacoes_insert_manager" ON "public"."insumo_apresentacoes"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumo_apresentacoes_update_manager" ON "public"."insumo_apresentacoes"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "insumo_apresentacoes_delete_manager" ON "public"."insumo_apresentacoes"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "insumo_apresentacoes_write_manager" ON "public"."insumo_apresentacoes";

-- 9. contrapartes
CREATE POLICY "contrapartes_insert_manager" ON "public"."contrapartes"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "contrapartes_update_manager" ON "public"."contrapartes"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "contrapartes_delete_manager" ON "public"."contrapartes"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "contrapartes_write_manager" ON "public"."contrapartes";

-- 10. fazenda_sanidade_config
CREATE POLICY "config_insert_manager" ON "public"."fazenda_sanidade_config"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "config_update_manager" ON "public"."fazenda_sanidade_config"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "config_delete_manager" ON "public"."fazenda_sanidade_config"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "config_write_manager" ON "public"."fazenda_sanidade_config";

-- 11. protocolos_sanitarios
CREATE POLICY "protocolos_insert_manager" ON "public"."protocolos_sanitarios"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "protocolos_update_manager" ON "public"."protocolos_sanitarios"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "protocolos_delete_manager" ON "public"."protocolos_sanitarios"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "protocolos_write_manager" ON "public"."protocolos_sanitarios";

-- 12. protocolos_sanitarios_itens
CREATE POLICY "protocolo_itens_insert_manager" ON "public"."protocolos_sanitarios_itens"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "protocolo_itens_update_manager" ON "public"."protocolos_sanitarios_itens"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "protocolo_itens_delete_manager" ON "public"."protocolos_sanitarios_itens"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "protocolo_itens_write_manager" ON "public"."protocolos_sanitarios_itens";

-- 13. sociedade_animais
CREATE POLICY "sociedade_animais_insert_manager" ON "public"."sociedade_animais"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "sociedade_animais_update_manager" ON "public"."sociedade_animais"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "sociedade_animais_delete_manager" ON "public"."sociedade_animais"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "sociedade_animais_write_manager" ON "public"."sociedade_animais";

-- 14. sociedades_pecuarias
CREATE POLICY "sociedades_pecuarias_insert_manager" ON "public"."sociedades_pecuarias"
  FOR INSERT TO "public"
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "sociedades_pecuarias_update_manager" ON "public"."sociedades_pecuarias"
  FOR UPDATE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]))
  WITH CHECK (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

CREATE POLICY "sociedades_pecuarias_delete_manager" ON "public"."sociedades_pecuarias"
  FOR DELETE TO "public"
  USING (role_in_fazenda(fazenda_id, ARRAY['owner'::farm_role_enum, 'manager'::farm_role_enum]));

DROP POLICY "sociedades_pecuarias_write_manager" ON "public"."sociedades_pecuarias";
