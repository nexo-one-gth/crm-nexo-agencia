-- ============================================================
-- Migración: Agregar campos faltantes a la tabla leads
-- Fecha: 2026-03-10
-- Descripción: Agrega las columnas 'source' y 'discard_reason' 
--              necesarias para la gestión y asignación de leads.
-- ============================================================

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS discard_reason TEXT;

COMMENT ON COLUMN public.leads.source IS 'Origen del lead (ej: Facebook, Web, Manual)';
COMMENT ON COLUMN public.leads.discard_reason IS 'Razón por la cual el lead fue descartado';
