-- Migration para Observabilidade Remota de Piloto
-- TD-021: Telemetria remota estruturada para operações de sync

CREATE TABLE IF NOT EXISTS public.metrics_events (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    fazenda_id uuid NOT NULL,
    event_name text NOT NULL,
    status text NOT NULL DEFAULT 'info',
    route text,
    entity text,
    quantity integer,
    reason_code text,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT metrics_events_pkey PRIMARY KEY (id),
    CONSTRAINT fk_metrics_fazenda FOREIGN KEY (fazenda_id) REFERENCES public.fazendas(id) ON DELETE CASCADE
);

-- RLS: Apenas membros da fazenda podem inserir telemetria ou visualizá-la
ALTER TABLE public.metrics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da fazenda podem ver telemetria"
    ON public.metrics_events
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (public.has_membership(fazenda_id));

CREATE POLICY "Membros da fazenda podem inserir telemetria"
    ON public.metrics_events
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_membership(fazenda_id));

-- Indices para queries operacionais / saúde do sync
CREATE INDEX idx_metrics_events_fazenda_created ON public.metrics_events USING btree (fazenda_id, created_at DESC);
CREATE INDEX idx_metrics_events_event_status ON public.metrics_events USING btree (event_name, status);

-- Trigger Imutabilidade: Telemetria é append-only
CREATE TRIGGER trg_metrics_events_append_only
    BEFORE UPDATE OR DELETE ON public.metrics_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_business_update();
