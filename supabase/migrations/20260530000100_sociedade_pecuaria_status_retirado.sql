-- Migration: sociedade_pecuaria_status_retirado
-- Adds 'retirado' to animal_status_enum to represent physical withdrawal of animals without marking them as sold or dead.

ALTER TYPE public.animal_status_enum ADD VALUE IF NOT EXISTS 'retirado';
