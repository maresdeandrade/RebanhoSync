-- Migration: add obito domain and causa enum

-- Add new value to dominio_enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dominio_enum') THEN
    RAISE EXCEPTION 'dominio_enum not found';
  END IF;
  BEGIN
    ALTER TYPE public.dominio_enum ADD VALUE IF NOT EXISTS 'obito';
  EXCEPTION WHEN duplicate_object THEN
    -- already exists, ignore
  END;
END $$;

-- Create enum for causa_obito
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'causa_obito_enum') THEN
    CREATE TYPE public.causa_obito_enum AS ENUM ('doenca', 'acidente', 'predador', 'outro');
  END IF;
END $$;

-- No new table needed; evento_obito will use eventos payload.
