-- Migration: Adicionar campos de custo e carencia para o modulo de insumos e movimentacoes.
-- Sem breaking changes, sem DROP, apenas colunas opcionais (nullable).

ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS principio_ativo text,
  ADD COLUMN IF NOT EXISTS concentracao text,
  ADD COLUMN IF NOT EXISTS carencia_carne_dias integer,
  ADD COLUMN IF NOT EXISTS carencia_leite_dias integer;

ALTER TABLE public.insumo_lotes
  ADD COLUMN IF NOT EXISTS custo_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS custo_unitario numeric(12,4);

ALTER TABLE public.insumo_movimentacoes
  ADD COLUMN IF NOT EXISTS custo_unitario_snapshot numeric(12,4),
  ADD COLUMN IF NOT EXISTS custo_total_snapshot numeric(12,2);
