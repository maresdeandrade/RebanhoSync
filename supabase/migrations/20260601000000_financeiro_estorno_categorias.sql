-- Migration: Financeiro Estorno e Categorias (Fase 16)
-- Resolve blockers: 
-- 1) Estorno: Coluna explícita reverses_transaction_id e origem estorno.
-- 2) Categorias default: Identidade canônica determinística por fazenda_id + slug.

-- ---------------------------------------------------------
-- ESTORNO
-- ---------------------------------------------------------

-- 1. Adicionar nova origem permitida na constraint ck_finance_transactions_origem
ALTER TABLE public.finance_transactions DROP CONSTRAINT ck_finance_transactions_origem;
ALTER TABLE public.finance_transactions ADD CONSTRAINT ck_finance_transactions_origem CHECK (origem IN ('manual', 'evento_financeiro', 'insumo_movimentacao', 'compra_animal', 'venda_animal', 'estorno'));

-- 2. Adicionar coluna reverses_transaction_id
ALTER TABLE public.finance_transactions ADD COLUMN reverses_transaction_id uuid;

-- 3. Adicionar FK composta (reverses_transaction_id, fazenda_id)
ALTER TABLE public.finance_transactions 
  ADD CONSTRAINT fk_finance_transactions_reverses_fazenda 
  FOREIGN KEY (reverses_transaction_id, fazenda_id) 
  REFERENCES public.finance_transactions(id, fazenda_id) ON DELETE RESTRICT;

-- 4. Impedir self-reference
ALTER TABLE public.finance_transactions 
  ADD CONSTRAINT ck_finance_transactions_no_self_reverse 
  CHECK (reverses_transaction_id IS NULL OR reverses_transaction_id <> id);

-- 5. Impedir múltiplos estornos ativos da mesma origem
CREATE UNIQUE INDEX ux_finance_transactions_unique_reversal 
  ON public.finance_transactions (fazenda_id, reverses_transaction_id) 
  WHERE reverses_transaction_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------
-- CATEGORIAS DEFAULT (IDENTIDADE CANÔNICA)
-- ---------------------------------------------------------

-- Criar extensão pgcrypto se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função PL/pgSQL que gera um UUID determinístico usando SHA-256 (compatível com a implementação JS do cliente)
CREATE OR REPLACE FUNCTION public.get_deterministic_finance_category_id(fazenda_id uuid, slug text) RETURNS uuid AS $$
DECLARE
  hash bytea;
  hex text;
  chars text[];
BEGIN
  -- Calcula o SHA-256 da string no formato "fazenda_id:slug"
  hash := digest(fazenda_id::text || ':' || slug, 'sha256');
  hex := encode(hash, 'hex');
  
  chars := string_to_array(hex, NULL);
  
  -- Define versão 5
  chars[13] := '5';
  -- Define variante (8, 9, a, b)
  chars[17] := to_hex((('x' || chars[17])::bit(4)::integer & 3) | 8);
  
  RETURN (
    array_to_string(chars[1:8], '') || '-' ||
    array_to_string(chars[9:12], '') || '-' ||
    array_to_string(chars[13:16], '') || '-' ||
    array_to_string(chars[17:20], '') || '-' ||
    array_to_string(chars[21:32], '')
  )::uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = public, extensions, pg_temp;

-- Migrar categorias existentes:
DO $$
DECLARE
  r RECORD;
  new_id uuid;
BEGIN
  FOR r IN SELECT id, fazenda_id, slug FROM public.finance_categories WHERE is_default = true LOOP
    new_id := public.get_deterministic_finance_category_id(r.fazenda_id, r.slug);
    IF r.id <> new_id THEN
      -- Para evitar violação da constraint uq_finance_categories_slug,
      -- alteramos temporariamente o slug da categoria antiga
      UPDATE public.finance_categories SET slug = slug || '-legacy-' || id WHERE id = r.id;

      -- Inserir nova categoria canônica (copiando os dados da antiga)
      INSERT INTO public.finance_categories (id, fazenda_id, nome, tipo, grupo, slug, is_default, ativo, observacoes, client_id, client_op_id, client_tx_id, client_recorded_at, server_received_at, created_at, updated_at, deleted_at)
      SELECT new_id, fazenda_id, nome, tipo, grupo, r.slug, is_default, ativo, observacoes, client_id, client_op_id, client_tx_id, client_recorded_at, server_received_at, created_at, updated_at, deleted_at
      FROM public.finance_categories WHERE id = r.id
      ON CONFLICT (id, fazenda_id) DO NOTHING;
      
      -- Atualizar as referências na tabela finance_transactions
      UPDATE public.finance_transactions SET category_id = new_id WHERE category_id = r.id AND fazenda_id = r.fazenda_id;
      
      -- Excluir a categoria antiga
      DELETE FROM public.finance_categories WHERE id = r.id AND fazenda_id = r.fazenda_id;
    END IF;
  END LOOP;
END;
$$;

-- Atualizar a função de seed para usar o ID determinístico
CREATE OR REPLACE FUNCTION public.seed_default_finance_categories()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.finance_categories (id, fazenda_id, nome, tipo, grupo, slug, is_default, ativo)
  VALUES
    (public.get_deterministic_finance_category_id(new.id, 'venda-animais'), new.id, 'Venda de Animais', 'receita', 'venda_animais', 'venda-animais', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'compra-animais'), new.id, 'Compra de Animais', 'custo_variavel', 'compra_animais', 'compra-animais', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'sanidade-medicamentos'), new.id, 'Sanidade/Medicamentos', 'custo_variavel', 'sanidade', 'sanidade-medicamentos', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'nutricao-alimentos'), new.id, 'Nutrição/Alimentos', 'custo_variavel', 'nutricao', 'nutricao-alimentos', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'mao-de-obra-salarios'), new.id, 'Mão de Obra/Salários', 'custo_fixo', 'mao_obra', 'mao-de-obra-salarios', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'combustivel'), new.id, 'Combustível', 'custo_variavel', 'combustivel', 'combustivel', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'manutencao'), new.id, 'Manutenção', 'custo_fixo', 'manutencao', 'manutencao', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'arrendamento'), new.id, 'Arrendamento', 'custo_fixo', 'arrendamento', 'arrendamento', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'infraestrutura'), new.id, 'Infraestrutura', 'investimento', 'infraestrutura', 'infraestrutura', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'reproducao-semen'), new.id, 'Reprodução/Sêmen', 'custo_variavel', 'reproducao', 'reproducao-semen', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'administrativo'), new.id, 'Administrativo', 'custo_fixo', 'administrativo', 'administrativo', true, true),
    (public.get_deterministic_finance_category_id(new.id, 'outros'), new.id, 'Outros', 'custo_variavel', 'outros', 'outros', true, true)
  ON CONFLICT (fazenda_id, slug) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
