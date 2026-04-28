-- TD-003: RLS DELETE sem Restrição de Role
-- Adiciona a restrição `WHERE role IN ('owner', 'manager')` na policy de write para `animais` separando INSERT/UPDATE de DELETE

BEGIN;

-- Remove a política genérica de escrita que permitia a cowboys deletarem animais
DROP POLICY IF EXISTS animais_write_by_membership ON public.animais;

-- Recria permitindo INSERT e UPDATE para todos os membros (incluindo cowboys)
CREATE POLICY animais_insert_update_by_membership
ON public.animais
FOR INSERT
WITH CHECK (public.has_membership(fazenda_id));

CREATE POLICY animais_update_by_membership
ON public.animais
FOR UPDATE
USING (public.has_membership(fazenda_id));

-- Cria política específica de DELETE restrita a owners e managers
CREATE POLICY animais_delete_by_role
ON public.animais
FOR DELETE
USING (
  public.has_membership(fazenda_id) AND
  public.role_in_fazenda(fazenda_id) IN ('owner', 'manager')
);

COMMIT;
