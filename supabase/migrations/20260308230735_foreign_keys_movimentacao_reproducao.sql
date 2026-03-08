-- TD-019: Foreign Keys Faltantes (Movimentação)
-- TD-020: Foreign Key macho_id Faltante (Reprodução)

BEGIN;

-- TD-019: Movimentação (from_lote_id e to_lote_id)
-- Validação de dados órfãos: Define null para IDs que não existem na tabela lotes antes de aplicar a FK
UPDATE public.eventos_movimentacao
SET from_lote_id = NULL
WHERE from_lote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lotes WHERE id = from_lote_id);

UPDATE public.eventos_movimentacao
SET to_lote_id = NULL
WHERE to_lote_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.lotes WHERE id = to_lote_id);

ALTER TABLE public.eventos_movimentacao
ADD CONSTRAINT fk_movimentacao_from_lote
FOREIGN KEY (from_lote_id) REFERENCES public.lotes(id) ON DELETE SET NULL;

ALTER TABLE public.eventos_movimentacao
ADD CONSTRAINT fk_movimentacao_to_lote
FOREIGN KEY (to_lote_id) REFERENCES public.lotes(id) ON DELETE SET NULL;


-- TD-020: Reprodução (macho_id)
-- Validação de dados órfãos: Define null para machos que não existem na tabela animais
UPDATE public.eventos_reproducao
SET macho_id = NULL
WHERE macho_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.animais WHERE id = macho_id);

ALTER TABLE public.eventos_reproducao
ADD CONSTRAINT fk_reproducao_macho
FOREIGN KEY (macho_id) REFERENCES public.animais(id) ON DELETE SET NULL;

COMMIT;
