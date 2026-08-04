-- =============================================================================
-- Alta: plantillas extensibles por prepaga (v2)
-- -----------------------------------------------------------------------------
-- Extiende el sistema de plantillas de checklist para soportar:
--   1. Ítems con sección "datos" (campos específicos por prepaga) separados
--      de la sección "documentos" (archivos + checks del checklist).
--   2. Template de resumen configurable por plantilla (interpolación {{var}}).
--   3. Snapshot de sección en alta_items para filtrado en tiempo de render.
--   4. Fix: selector de plantilla en iniciarAlta() ahora prefiere la específica
--      por tipo_alta antes de caer al fallback genérico (tipo_alta IS NULL).
--   5. Constraint: un lead no puede tener dos altas activas para la misma
--      prepaga al mismo tiempo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. checklist_plantilla_items — agregar columna de sección
-- ---------------------------------------------------------------------------
ALTER TABLE public.checklist_plantilla_items
  ADD COLUMN IF NOT EXISTS seccion text NOT NULL DEFAULT 'documentos'
  CONSTRAINT checklist_plantilla_items_seccion_check
    CHECK (seccion IN ('documentos', 'datos'));

COMMENT ON COLUMN public.checklist_plantilla_items.seccion IS
  'documentos = archivo o check a subir/marcar; datos = campo de dato específico por prepaga (texto/numero/fecha)';

-- ---------------------------------------------------------------------------
-- 2. checklist_plantillas — agregar template de resumen
-- ---------------------------------------------------------------------------
ALTER TABLE public.checklist_plantillas
  ADD COLUMN IF NOT EXISTS resumen_template text;

COMMENT ON COLUMN public.checklist_plantillas.resumen_template IS
  'Plantilla de texto para el resumen del trámite con variables {{nombre_var}}. '
  'Variables disponibles: plan_codigo, condicion, cuota, capitas, aportes, sueldo_bruto, periodo, '
  'titular_nombre, titular_dni, titular_cuil, titular_edad, titular_peso, titular_altura, titular_domicilio, titular_tel, titular_email, '
  'integrante_2_nombre, integrante_2_dni, etc. '
  'Datos específicos de la prepaga: datos.nombre_del_campo (etiqueta normalizada a minúsculas con guiones bajos).';

-- ---------------------------------------------------------------------------
-- 3. alta_items — agregar snapshot de sección (copiado de la plantilla)
-- ---------------------------------------------------------------------------
ALTER TABLE public.alta_items
  ADD COLUMN IF NOT EXISTS seccion text NOT NULL DEFAULT 'documentos'
  CONSTRAINT alta_items_seccion_check
    CHECK (seccion IN ('documentos', 'datos'));

COMMENT ON COLUMN public.alta_items.seccion IS
  'Snapshot de checklist_plantilla_items.seccion al momento de iniciar el alta.';

-- ---------------------------------------------------------------------------
-- 4. Constraint: unicidad de alta activa por (lead, prepaga)
--    Solo puede haber una alta en estado no-terminal para el mismo lead+prepaga.
--    Las altas aprobadas/rechazadas no cuentan (permiten reintentos).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_altas_lead_prepaga_activa
  ON public.altas (lead_id, prepaga_id)
  WHERE estado NOT IN ('aprobada', 'rechazada');
