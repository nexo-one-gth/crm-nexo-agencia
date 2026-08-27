-- =============================================================================
-- Ciclo de alta — piloto SANCOR desregulado (schema)
-- -----------------------------------------------------------------------------
-- Tres cambios chicos, todos aditivos:
--   1. altas.cotizacion_id  → la venta sabe de qué cotización salió.
--   2. Unicidad de plantilla activa por (prepaga, tipo_alta) → "por prepaga ×
--      condición" pasa a ser una garantía del modelo, no una convención.
--   3. activities.alta_id   → los eventos de un trámite se pueden filtrar por
--      trámite, no solo por lead (gap #1 de ANALISIS_TRAZABILIDAD_PREPAGAS.md).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. altas.cotizacion_id
--    Hasta ahora cotización y alta eran dos objetos sueltos del mismo lead: no
--    había forma de responder "¿con qué números se vendió esto?" ni de
--    prefillear el alta con lo que el asesor ya cargó en el cotizador.
--    ON DELETE SET NULL: borrar una cotización no debe borrar la venta.
-- ---------------------------------------------------------------------------
ALTER TABLE public.altas
  ADD COLUMN IF NOT EXISTS cotizacion_id uuid
    REFERENCES public.lead_cotizaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS altas_cotizacion_id_idx
  ON public.altas (cotizacion_id) WHERE cotizacion_id IS NOT NULL;

COMMENT ON COLUMN public.altas.cotizacion_id IS
  'Cotización que originó el alta. Fuente del prefill de plan/cuota/cápitas/integrantes.';

-- ---------------------------------------------------------------------------
-- 2. Una sola plantilla activa por (prepaga, tipo_alta)
--    iniciarAlta() elige la plantilla con .limit(1): si hubiera dos activas
--    para la misma combinación, cuál gana dependería del orden que devuelva
--    Postgres. Dos índices porque en Postgres NULL != NULL: el parcial sobre
--    tipo_alta IS NULL cubre la plantilla genérica de fallback.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantilla_activa_prepaga_tipo
  ON public.checklist_plantillas (prepaga_id, tipo_alta)
  WHERE activa = true AND tipo_alta IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_plantilla_activa_prepaga_generica
  ON public.checklist_plantillas (prepaga_id)
  WHERE activa = true AND tipo_alta IS NULL;

-- ---------------------------------------------------------------------------
-- 3. activities.alta_id
--    Los eventos del alta (iniciada, cambio de estado, comisión) se colgaban
--    solo del lead. Con un reintento de venta tras un rechazo, los eventos de
--    ambas altas quedaban mezclados en el mismo timeline, distinguibles solo
--    por texto libre. Nullable: las actividades del lead (lead_created,
--    stage_change, whatsapp_sent) siguen sin alta.
--    ON DELETE CASCADE: si se borra el alta, sus eventos no tienen sentido.
-- ---------------------------------------------------------------------------
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS alta_id uuid
    REFERENCES public.altas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS activities_alta_id_idx
  ON public.activities (alta_id, created_at DESC) WHERE alta_id IS NOT NULL;

COMMENT ON COLUMN public.activities.alta_id IS
  'Trámite al que pertenece el evento. NULL = actividad del lead, no de un alta puntual.';

-- Nota de seguridad: no se agregan policies. `activities` ya hereda la
-- visibilidad del lead (activities_select) y sigue siendo de solo-agregado para
-- no-admins (activities_insert exige created_by = auth.uid(); no hay UPDATE ni
-- DELETE fuera de activities_admin_write). Agregar alta_id no abre nada nuevo:
-- quien ve el lead ya veía estos eventos.
