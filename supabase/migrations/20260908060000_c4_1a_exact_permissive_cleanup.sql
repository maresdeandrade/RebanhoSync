-- C4.1a — Remoção Incremental de Redundâncias Exatas (REDUNDANT_EXACT)
-- Split dos 3 comandos 'FOR ALL' redundantes para SELECT em policies específicas de escrita:
-- 1. public.agenda_itens
-- 2. public.animais
-- 3. public.sanitario_casos
--
-- Preserva integralmente os predicados de has_membership(fazenda_id) e os papéis {public}.
-- Elimina a sobreposição em SELECT com as policies *_select_member existentes.

-- 1. agenda_itens
CREATE POLICY "agenda_insert_member" ON "public"."agenda_itens"
  FOR INSERT TO "public"
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "agenda_update_member" ON "public"."agenda_itens"
  FOR UPDATE TO "public"
  USING (has_membership(fazenda_id))
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "agenda_delete_member" ON "public"."agenda_itens"
  FOR DELETE TO "public"
  USING (has_membership(fazenda_id));

DROP POLICY "agenda_write_member" ON "public"."agenda_itens";

-- 2. animais
CREATE POLICY "animais_insert_member" ON "public"."animais"
  FOR INSERT TO "public"
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "animais_update_member" ON "public"."animais"
  FOR UPDATE TO "public"
  USING (has_membership(fazenda_id))
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "animais_delete_member" ON "public"."animais"
  FOR DELETE TO "public"
  USING (has_membership(fazenda_id));

DROP POLICY "animais_write_member" ON "public"."animais";

-- 3. sanitario_casos
CREATE POLICY "sanitario_casos_insert_member" ON "public"."sanitario_casos"
  FOR INSERT TO "public"
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "sanitario_casos_update_member" ON "public"."sanitario_casos"
  FOR UPDATE TO "public"
  USING (has_membership(fazenda_id))
  WITH CHECK (has_membership(fazenda_id));

CREATE POLICY "sanitario_casos_delete_member" ON "public"."sanitario_casos"
  FOR DELETE TO "public"
  USING (has_membership(fazenda_id));

DROP POLICY "sanitario_casos_write_member" ON "public"."sanitario_casos";
