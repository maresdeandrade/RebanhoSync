-- Migration: sociedade_pecuaria_sync_metadata
-- Adds standard sync metadata columns to sociedades_pecuarias and sociedade_animais to prevent DB_PGRST204 errors during sync-batch execution.

-- 1. Add columns to sociedades_pecuarias
ALTER TABLE public.sociedades_pecuarias 
  ADD COLUMN IF NOT EXISTS client_id text NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_tx_id uuid,
  ADD COLUMN IF NOT EXISTS client_recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS server_received_at timestamptz NOT NULL DEFAULT now();

-- 2. Add columns to sociedade_animais
ALTER TABLE public.sociedade_animais 
  ADD COLUMN IF NOT EXISTS client_id text NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_tx_id uuid,
  ADD COLUMN IF NOT EXISTS client_recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS server_received_at timestamptz NOT NULL DEFAULT now();

-- 3. Idempotency unique index per client_op_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_sociedades_pecuarias_client_op_id 
  ON public.sociedades_pecuarias (fazenda_id, client_op_id) WHERE client_op_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sociedade_animais_client_op_id 
  ON public.sociedade_animais (fazenda_id, client_op_id) WHERE client_op_id IS NOT NULL;

-- 4. Search and indexing on client_tx_id
CREATE INDEX IF NOT EXISTS idx_sociedades_pecuarias_client_tx_id 
  ON public.sociedades_pecuarias (client_tx_id);

CREATE INDEX IF NOT EXISTS idx_sociedade_animais_client_tx_id 
  ON public.sociedade_animais (client_tx_id);
