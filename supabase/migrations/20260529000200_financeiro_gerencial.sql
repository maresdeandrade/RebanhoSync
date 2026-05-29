-- Migration: Ledger Gerencial Administrativo / Lançamentos Financeiros Gerenciais
-- Sem breaking changes, sem DROP, apenas colunas opcionais (nullable) e tabelas aditivas.

-- 1. Tabela de Categorias Financeiras Gerenciais
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL,
  grupo text NOT NULL,
  slug text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  client_id text NOT NULL DEFAULT 'server',
  client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz NOT NULL DEFAULT now(),
  server_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (id, fazenda_id),
  CONSTRAINT ck_finance_categories_tipo CHECK (tipo IN ('receita', 'custo_variavel', 'custo_fixo', 'investimento')),
  CONSTRAINT ck_finance_categories_grupo CHECK (grupo IN ('venda_animais', 'compra_animais', 'sanidade', 'nutricao', 'mao_obra', 'combustivel', 'manutencao', 'arrendamento', 'infraestrutura', 'reproducao', 'administrativo', 'outros')),
  CONSTRAINT uq_finance_categories_slug UNIQUE (fazenda_id, slug),
  CONSTRAINT ck_finance_categories_nome_not_blank check (length(btrim(nome)) > 0)
);

-- 2. Assegurar constraint unique (id, fazenda_id) em insumo_movimentacoes para FK composta
ALTER TABLE public.insumo_movimentacoes ADD CONSTRAINT uq_insumo_movimentacoes_id_fazenda UNIQUE (id, fazenda_id);

-- 3. Tabela de Lançamentos Financeiros Gerenciais
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  competence_date date,
  due_date date,
  paid_at timestamptz,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'realizado',
  category_id uuid NOT NULL,
  valor_total numeric(14,2) NOT NULL,
  quantidade numeric(12,4),
  unidade text,
  valor_unitario numeric(14,4),
  contraparte_id uuid,
  animal_id uuid,
  lote_id uuid,
  pasto_id uuid,
  centro_custo_tipo text,
  centro_custo_id uuid,
  rateio_metodo text,
  origem text,
  source_event_id uuid,
  source_inventory_movement_id uuid,
  observacoes text,
  client_id text NOT NULL DEFAULT 'server',
  client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz NOT NULL DEFAULT now(),
  server_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (id, fazenda_id),
  CONSTRAINT ck_finance_transactions_direction CHECK (direction IN ('entrada', 'saida')),
  CONSTRAINT ck_finance_transactions_status CHECK (status IN ('previsto', 'realizado', 'cancelado')),
  CONSTRAINT ck_finance_transactions_valor_pos CHECK (valor_total > 0),
  CONSTRAINT ck_finance_transactions_cc_tipo CHECK (centro_custo_tipo IN ('fazenda', 'animal', 'lote', 'pasto')),
  CONSTRAINT ck_finance_transactions_rateio CHECK (rateio_metodo IN ('direto', 'por_cabeca', 'por_peso_vivo', 'por_dias', 'por_area')),
  CONSTRAINT ck_finance_transactions_origem CHECK (origem IN ('manual', 'evento_financeiro', 'insumo_movimentacao', 'compra_animal', 'venda_animal')),
  
  -- Composite keys tenant isolation
  CONSTRAINT fk_finance_transactions_category_fazenda FOREIGN KEY (category_id, fazenda_id) REFERENCES public.finance_categories(id, fazenda_id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_transactions_contraparte_fazenda FOREIGN KEY (contraparte_id, fazenda_id) REFERENCES public.contrapartes(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_animal_fazenda FOREIGN KEY (animal_id, fazenda_id) REFERENCES public.animais(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_lote_fazenda FOREIGN KEY (lote_id, fazenda_id) REFERENCES public.lotes(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_pasto_fazenda FOREIGN KEY (pasto_id, fazenda_id) REFERENCES public.pastos(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_source_event_fazenda FOREIGN KEY (source_event_id, fazenda_id) REFERENCES public.eventos(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_transactions_source_movement_fazenda FOREIGN KEY (source_inventory_movement_id, fazenda_id) REFERENCES public.insumo_movimentacoes(id, fazenda_id) ON DELETE SET NULL
);

-- 4. Constraint/Index único para client_op_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_transactions_client_op_id ON public.finance_transactions (fazenda_id, client_op_id) WHERE client_op_id IS NOT NULL;

-- 5. Índices de busca e ordenação
CREATE INDEX IF NOT EXISTS idx_finance_categories_fazenda ON public.finance_categories(fazenda_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_fazenda ON public.finance_transactions(fazenda_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_cc ON public.finance_transactions(fazenda_id, centro_custo_tipo, centro_custo_id, deleted_at);

-- 6. Trigger set_updated_at
DROP TRIGGER IF EXISTS trg_finance_categories_updated_at ON public.finance_categories;
CREATE TRIGGER trg_finance_categories_updated_at
  BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_finance_transactions_updated_at ON public.finance_transactions;
CREATE TRIGGER trg_finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Trigger de Auto-Seeding das Categorias Padrão
CREATE OR REPLACE FUNCTION public.seed_default_finance_categories()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.finance_categories (fazenda_id, nome, tipo, grupo, slug, is_default, ativo)
  VALUES
    (new.id, 'Venda de Animais', 'receita', 'venda_animais', 'venda-animais', true, true),
    (new.id, 'Compra de Animais', 'custo_variavel', 'compra_animais', 'compra-animais', true, true),
    (new.id, 'Sanidade/Medicamentos', 'custo_variavel', 'sanidade', 'sanidade-medicamentos', true, true),
    (new.id, 'Nutrição/Alimentos', 'custo_variavel', 'nutricao', 'nutricao-alimentos', true, true),
    (new.id, 'Mão de Obra/Salários', 'custo_fixo', 'mao_obra', 'mao-de-obra-salarios', true, true),
    (new.id, 'Combustível', 'custo_variavel', 'combustivel', 'combustivel', true, true),
    (new.id, 'Manutenção', 'custo_fixo', 'manutencao', 'manutencao', true, true),
    (new.id, 'Arrendamento', 'custo_fixo', 'arrendamento', 'arrendamento', true, true),
    (new.id, 'Infraestrutura', 'investimento', 'infraestrutura', 'infraestrutura', true, true),
    (new.id, 'Reprodução/Sêmen', 'custo_variavel', 'reproducao', 'reproducao-semen', true, true),
    (new.id, 'Administrativo', 'custo_fixo', 'administrativo', 'administrativo', true, true),
    (new.id, 'Outros', 'custo_variavel', 'outros', 'outros', true, true)
  ON CONFLICT (fazenda_id, slug) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_default_finance_categories ON public.fazendas;
CREATE TRIGGER trg_seed_default_finance_categories
  AFTER INSERT ON public.fazendas
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_finance_categories();

-- 8. Executar o seeding para todas as fazendas existentes
INSERT INTO public.finance_categories (fazenda_id, nome, tipo, grupo, slug, is_default, ativo)
SELECT fazenda_id, nome, tipo, grupo, slug, true as is_default, true as ativo FROM (
  SELECT f.id as fazenda_id, c.nome, c.tipo, c.grupo, c.slug
  FROM public.fazendas f
  CROSS JOIN (
    VALUES
      ('Venda de Animais', 'receita', 'venda_animais', 'venda-animais'),
      ('Compra de Animais', 'custo_variavel', 'compra_animais', 'compra-animais'),
      ('Sanidade/Medicamentos', 'custo_variavel', 'sanidade', 'sanidade-medicamentos'),
      ('Nutrição/Alimentos', 'custo_variavel', 'nutricao', 'nutricao-alimentos'),
      ('Mão de Obra/Salários', 'custo_fixo', 'mao_obra', 'mao-de-obra-salarios'),
      ('Combustível', 'custo_variavel', 'combustivel', 'combustivel'),
      ('Manutenção', 'custo_fixo', 'manutencao', 'manutencao'),
      ('Arrendamento', 'custo_fixo', 'arrendamento', 'arrendamento'),
      ('Infraestrutura', 'investimento', 'infraestrutura', 'infraestrutura'),
      ('Reprodução/Sêmen', 'custo_variavel', 'reproducao', 'reproducao-semen'),
      ('Administrativo', 'custo_fixo', 'administrativo', 'administrativo'),
      ('Outros', 'custo_variavel', 'outros', 'outros')
  ) c(nome, tipo, grupo, slug)
) sub
ON CONFLICT (fazenda_id, slug) DO NOTHING;

-- 9. Habilitar RLS e criar Políticas
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_categories_select_member ON public.finance_categories;
CREATE POLICY finance_categories_select_member
  ON public.finance_categories FOR SELECT
  USING (public.has_membership(fazenda_id));

DROP POLICY IF EXISTS finance_categories_write_manager ON public.finance_categories;
CREATE POLICY finance_categories_write_manager
  ON public.finance_categories FOR ALL
  USING (public.role_in_fazenda(fazenda_id, ARRAY['owner','manager']::public.farm_role_enum[]))
  WITH CHECK (public.role_in_fazenda(fazenda_id, ARRAY['owner','manager']::public.farm_role_enum[]));

DROP POLICY IF EXISTS finance_transactions_select_member ON public.finance_transactions;
CREATE POLICY finance_transactions_select_member
  ON public.finance_transactions FOR SELECT
  USING (public.has_membership(fazenda_id));

DROP POLICY IF EXISTS finance_transactions_write_manager ON public.finance_transactions;
CREATE POLICY finance_transactions_write_manager
  ON public.finance_transactions FOR ALL
  USING (public.role_in_fazenda(fazenda_id, ARRAY['owner','manager']::public.farm_role_enum[]))
  WITH CHECK (public.role_in_fazenda(fazenda_id, ARRAY['owner','manager']::public.farm_role_enum[]));
