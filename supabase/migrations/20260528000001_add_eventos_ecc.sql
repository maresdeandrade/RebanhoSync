-- Migration: add_eventos_ecc
-- Adds detail table for individual ECC scores

-- Add ecc domain value to dominio_enum
ALTER TYPE public.dominio_enum ADD VALUE IF NOT EXISTS 'ecc';

CREATE TABLE public.eventos_ecc (
  event_id uuid PRIMARY KEY REFERENCES public.eventos(id) ON DELETE CASCADE,
  fazenda_id uuid NOT NULL,
  animal_id uuid NOT NULL,
  ecc numeric(3,2) NOT NULL,
  escala_min numeric(3,2) NOT NULL DEFAULT 1.00,
  escala_max numeric(3,2) NOT NULL DEFAULT 5.00,
  escala_passo numeric(3,2) NOT NULL DEFAULT 0.25,
  observacoes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id text NOT NULL DEFAULT 'server',
  client_op_id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_tx_id uuid,
  client_recorded_at timestamptz NOT NULL DEFAULT now(),
  server_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_ecc_range CHECK (ecc >= escala_min AND ecc <= escala_max),
  CONSTRAINT chk_escala_order CHECK (escala_min < escala_max),
  CONSTRAINT chk_escala_step CHECK (((ecc - escala_min) / escala_passo) = floor((ecc - escala_min) / escala_passo))
);

-- Indexes
CREATE INDEX idx_eventos_ecc_fazenda_animal ON public.eventos_ecc (fazenda_id, animal_id);
CREATE INDEX idx_eventos_ecc_fazenda_deleted ON public.eventos_ecc (fazenda_id, deleted_at);

-- RLS policy similar to eventos_pesagem
ALTER TABLE public.eventos_ecc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_fazenda_access" ON public.eventos_ecc
  USING (auth.uid() = ANY (SELECT user_id FROM public.user_fazendas WHERE fazenda_id = eventos_ecc.fazenda_id));
