-- 20260408120000_add_repro_aborto.sql
-- Parte 1: Somente o Enum (deve ser commitado antes do uso)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'repro_tipo_enum'::regtype AND enumlabel = 'aborto') THEN
    ALTER TYPE repro_tipo_enum ADD VALUE 'aborto';
  END IF;
END $$;
