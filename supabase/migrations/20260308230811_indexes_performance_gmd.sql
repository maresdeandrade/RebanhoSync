-- TD-004: Índices de Performance Faltantes
-- TD-015: Cálculo de GMD em Memória (View Otimizada)

BEGIN;

-- TD-004: Índices de Performance
CREATE INDEX IF NOT EXISTS idx_event_eventos_fazenda_occurred_at
ON public.event_eventos (fazenda_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_eventos_animal_occurred_at
ON public.event_eventos (animal_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_eventos_pesagem_peso
ON public.event_eventos_pesagem (evento_id, peso_kg);

-- TD-015: View Otimizada para cálculo do GMD (Ganho Médio Diário)
CREATE OR REPLACE VIEW public.vw_animal_gmd AS
WITH pesagens_ordenadas AS (
    SELECT
        ee.animal_id,
        ee.fazenda_id,
        ep.peso_kg,
        ee.occurred_at,
        ROW_NUMBER() OVER (PARTITION BY ee.animal_id ORDER BY ee.occurred_at DESC) as rn
    FROM public.event_eventos ee
    JOIN public.event_eventos_pesagem ep ON ep.evento_id = ee.id
    WHERE ee.deleted_at IS NULL
),
ultimas_duas_pesagens AS (
    SELECT
        p1.animal_id,
        p1.fazenda_id,
        p1.peso_kg as peso_atual,
        p1.occurred_at as data_atual,
        p2.peso_kg as peso_anterior,
        p2.occurred_at as data_anterior
    FROM pesagens_ordenadas p1
    LEFT JOIN pesagens_ordenadas p2 ON p1.animal_id = p2.animal_id AND p2.rn = 2
    WHERE p1.rn = 1
)
SELECT
    animal_id,
    fazenda_id,
    peso_atual,
    data_atual,
    peso_anterior,
    data_anterior,
    CASE
        WHEN peso_anterior IS NULL OR data_anterior IS NULL OR data_atual <= data_anterior THEN NULL
        ELSE (peso_atual - peso_anterior) / EXTRACT(DAY FROM (data_atual - data_anterior))
    END as gmd_kg_dia
FROM ultimas_duas_pesagens;

COMMIT;
