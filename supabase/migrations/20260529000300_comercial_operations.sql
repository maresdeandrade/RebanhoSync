-- Migration: comercial_operations
-- Adds detail table for commercial operations (purchase/sale) of animals or lots

-- 1. Safe addition of 'comercial' to dominio_enum
ALTER TYPE public.dominio_enum ADD VALUE IF NOT EXISTS 'comercial';

-- 2. Tabela de Lançamentos de Detalhe Comercial
CREATE TABLE IF NOT EXISTS public.eventos_comercial (
  evento_id uuid PRIMARY KEY,
  fazenda_id uuid NOT NULL,
  
  operation_type text NOT NULL,
  scope text NOT NULL,
  occurred_at timestamptz NOT NULL,
  
  quantidade_animais integer NOT NULL,
  peso_vivo_total numeric(12,2),
  peso_medio_derivado numeric(12,2),
  
  valor_bruto numeric(14,2),
  frete numeric(14,2),
  comissao numeric(14,2),
  descontos numeric(14,2),
  taxas_impostos numeric(14,2),
  valor_liquido_derivado numeric(14,2),
  
  contraparte_id uuid,
  contraparte_nome text,
  
  animal_ids uuid[],
  lote_id uuid,
  
  finance_transaction_id uuid,
  
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_status text NOT NULL DEFAULT 'partial',
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  observacoes text,
  
  -- Campos de sistema padrão
  client_id text NOT NULL DEFAULT 'server',
  client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz NOT NULL DEFAULT now(),
  server_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  
  -- Composite keys tenant isolation constraints
  UNIQUE (evento_id, fazenda_id),
  CONSTRAINT fk_eventos_comercial_evento_fazenda FOREIGN KEY (evento_id, fazenda_id) REFERENCES public.eventos(id, fazenda_id) ON DELETE CASCADE,
  CONSTRAINT fk_eventos_comercial_contraparte_fazenda FOREIGN KEY (contraparte_id, fazenda_id) REFERENCES public.contrapartes(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_eventos_comercial_lote_fazenda FOREIGN KEY (lote_id, fazenda_id) REFERENCES public.lotes(id, fazenda_id) ON DELETE SET NULL,
  CONSTRAINT fk_eventos_comercial_finance_transaction_fazenda FOREIGN KEY (finance_transaction_id, fazenda_id) REFERENCES public.finance_transactions(id, fazenda_id) ON DELETE SET NULL,
  
  -- Basic constraints
  CONSTRAINT ck_eventos_comercial_operation_type CHECK (operation_type IN ('compra', 'venda')),
  CONSTRAINT ck_eventos_comercial_scope CHECK (scope IN ('animal', 'lote')),
  CONSTRAINT ck_eventos_comercial_quantidade_animais CHECK (quantidade_animais > 0),
  CONSTRAINT ck_eventos_comercial_peso_vivo_total CHECK (peso_vivo_total IS NULL OR peso_vivo_total >= 0),
  CONSTRAINT ck_eventos_comercial_peso_medio_derivado CHECK (peso_medio_derivado IS NULL OR peso_medio_derivado >= 0),
  CONSTRAINT ck_eventos_comercial_valor_bruto CHECK (valor_bruto IS NULL OR valor_bruto >= 0),
  CONSTRAINT ck_eventos_comercial_frete CHECK (frete IS NULL OR frete >= 0),
  CONSTRAINT ck_eventos_comercial_comissao CHECK (comissao IS NULL OR comissao >= 0),
  CONSTRAINT ck_eventos_comercial_descontos CHECK (descontos IS NULL OR descontos >= 0),
  CONSTRAINT ck_eventos_comercial_taxas_impostos CHECK (taxas_impostos IS NULL OR taxas_impostos >= 0),
  CONSTRAINT ck_eventos_comercial_valor_liquido_derivado CHECK (valor_liquido_derivado IS NULL OR valor_liquido_derivado >= 0),
  CONSTRAINT ck_eventos_comercial_calculation_status CHECK (calculation_status IN ('complete', 'partial', 'blocked'))
);

-- 3. Idempotency unique index per client_op_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_comercial_client_op_id ON public.eventos_comercial (fazenda_id, client_op_id) WHERE client_op_id IS NOT NULL;

-- 4. Search and indexing
CREATE INDEX IF NOT EXISTS idx_eventos_comercial_fazenda ON public.eventos_comercial (fazenda_id, occurred_at DESC, deleted_at);
CREATE INDEX IF NOT EXISTS idx_eventos_comercial_lote ON public.eventos_comercial (fazenda_id, lote_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_eventos_comercial_finance_transaction ON public.eventos_comercial (fazenda_id, finance_transaction_id, deleted_at);

-- 5. Trigger set_updated_at
DROP TRIGGER IF EXISTS trg_eventos_comercial_updated_at ON public.eventos_comercial;
CREATE TRIGGER trg_eventos_comercial_updated_at
  BEFORE UPDATE ON public.eventos_comercial
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Habilitar RLS e criar políticas
ALTER TABLE public.eventos_comercial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_comercial_select_member ON public.eventos_comercial;
CREATE POLICY eventos_comercial_select_member
  ON public.eventos_comercial FOR SELECT
  USING (public.has_membership(fazenda_id));

DROP POLICY IF EXISTS eventos_comercial_insert_member ON public.eventos_comercial;
CREATE POLICY eventos_comercial_insert_member
  ON public.eventos_comercial FOR INSERT
  WITH CHECK (public.has_membership(fazenda_id));

DROP POLICY IF EXISTS eventos_comercial_update_manager ON public.eventos_comercial;
CREATE POLICY eventos_comercial_update_manager
  ON public.eventos_comercial FOR UPDATE
  USING (public.role_in_fazenda(fazenda_id, ARRAY['owner', 'manager']::public.farm_role_enum[]))
  WITH CHECK (public.role_in_fazenda(fazenda_id, ARRAY['owner', 'manager']::public.farm_role_enum[]));
