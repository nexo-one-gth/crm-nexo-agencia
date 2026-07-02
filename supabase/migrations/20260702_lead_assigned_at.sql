-- =============================================================================
-- MIGRACIÓN: Fecha de asignación de leads
-- Fecha: 2026-07-02
-- Propósito: Registrar cuándo se asigna un lead a un asesor para poder
--   reportar "cantidad de leads asignados entre fechas" en el panel admin.
--   Un trigger mantiene assigned_at automáticamente en cualquier vía de
--   asignación (creación manual, importación, tablero de asignación).
-- =============================================================================

-- 1. Columna nueva
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill: leads ya asignados toman su fecha de creación como aproximación
UPDATE public.leads
SET assigned_at = created_at
WHERE assigned_to IS NOT NULL
  AND assigned_at IS NULL;

-- 3. Trigger: setea assigned_at cuando el lead recibe (o cambia de) asesor
CREATE OR REPLACE FUNCTION public.set_lead_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      IF NEW.assigned_to IS NULL THEN
        NEW.assigned_at := NULL;
      ELSE
        NEW.assigned_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_assigned_at ON public.leads;
CREATE TRIGGER trg_lead_assigned_at
  BEFORE INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_assigned_at();

-- 4. Índice para el reporte por rango de fechas
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at
  ON public.leads (assigned_at)
  WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;
