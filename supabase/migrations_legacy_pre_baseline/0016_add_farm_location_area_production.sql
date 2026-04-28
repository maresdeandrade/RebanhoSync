-- Migration: 0016_add_farm_location_area_production.sql
-- Description: Adiciona campos de localização, área e produção à tabela fazendas
-- Author: Sistema
-- Date: 2026-02-07

-- =====================================================
-- PARTE 1: Criar tipos ENUM (seguindo padrão do projeto)
-- =====================================================

-- ENUM para estados (UFs brasileiras)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_uf_enum') THEN
    CREATE TYPE public.estado_uf_enum AS ENUM (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
      'MT','MS','MG','PA','PB','PR','PE','PI','RJ',
      'RN','RS','RO','RR','SC','SP','SE','TO'
    );
  END IF;
END $$;

-- ENUM para tipo de produção pecuária
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_producao_enum') THEN
    CREATE TYPE public.tipo_producao_enum AS ENUM ('corte', 'leite', 'mista');
  END IF;
END $$;

-- ENUM para sistema de manejo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sistema_manejo_enum') THEN
    CREATE TYPE public.sistema_manejo_enum AS ENUM (
      'confinamento',
      'semi_confinamento',
      'pastagem'
    );
  END IF;
END $$;

-- =====================================================
-- PARTE 2: Adicionar colunas à tabela fazendas
-- =====================================================

ALTER TABLE public.fazendas
ADD COLUMN IF NOT EXISTS estado public.estado_uf_enum NULL,
ADD COLUMN IF NOT EXISTS cep text NULL,
ADD COLUMN IF NOT EXISTS area_total_ha numeric(12,2) NULL,
ADD COLUMN IF NOT EXISTS tipo_producao public.tipo_producao_enum NULL,
ADD COLUMN IF NOT EXISTS sistema_manejo public.sistema_manejo_enum NULL;

-- =====================================================
-- PARTE 3: Constraints de validação (apenas para campos não-ENUM)
-- =====================================================

-- Validação de formato CEP
ALTER TABLE public.fazendas
ADD CONSTRAINT ck_fazendas_cep_formato
CHECK (cep IS NULL OR cep ~ '^\d{5}-\d{3}$');

-- Validação de área positiva
ALTER TABLE public.fazendas
ADD CONSTRAINT ck_fazendas_area_positiva
CHECK (area_total_ha IS NULL OR area_total_ha > 0);

-- =====================================================
-- PARTE 4: Índices para performance
-- =====================================================

CREATE INDEX IF NOT EXISTS ix_fazendas_estado 
ON public.fazendas(estado) 
WHERE estado IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_fazendas_area_total 
ON public.fazendas(area_total_ha) 
WHERE area_total_ha IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_fazendas_tipo_producao 
ON public.fazendas(tipo_producao) 
WHERE tipo_producao IS NOT NULL;

-- =====================================================
-- PARTE 5: Comentários de documentação
-- =====================================================

COMMENT ON COLUMN public.fazendas.estado IS 'Sigla da UF (ex: SP, MG, GO)';
COMMENT ON COLUMN public.fazendas.cep IS 'CEP da propriedade (formato: XXXXX-XXX)';
COMMENT ON COLUMN public.fazendas.area_total_ha IS 'Área total em hectares';
COMMENT ON COLUMN public.fazendas.tipo_producao IS 'Tipo: corte, leite ou mista';
COMMENT ON COLUMN public.fazendas.sistema_manejo IS 'Sistema: confinamento, semi_confinamento ou pastagem';
COMMENT ON COLUMN public.fazendas.benfeitorias IS 'JSON com dados de infraestrutura (currais, cochos, reservatórios, etc.)';
