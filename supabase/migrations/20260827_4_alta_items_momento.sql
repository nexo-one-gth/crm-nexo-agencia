-- =============================================================================
-- Checklist en dos momentos: envío y post-aprobación
-- -----------------------------------------------------------------------------
-- Regla de negocio (agencia, 2026-08-27): en un desregulado de relación de
-- dependencia, la constancia de derivación de aportes NO se manda con el alta.
-- Recién cuando el admin aprueba se adjunta, y con eso el trámite pasa a
-- liquidación.
--
-- O sea: los ítems de un trámite no vencen todos en el mismo momento. Hasta
-- ahora el checklist era uno solo y se cerraba entero en el envío, lo que
-- obligaba a una de dos cosas malas: pedir la constancia antes de que exista
-- (bloquea el envío para siempre) o no pedirla nunca (se liquida sin ella).
--
-- Se modela como un atributo del ítem, no como un estado nuevo del alta: qué
-- documento vence cuándo depende de la prepaga y la condición, que es
-- exactamente lo que ya discrimina la plantilla.
-- =============================================================================

ALTER TABLE public.checklist_plantilla_items
  ADD COLUMN IF NOT EXISTS momento text NOT NULL DEFAULT 'envio'
  CONSTRAINT checklist_plantilla_items_momento_check
    CHECK (momento IN ('envio', 'post_aprobacion'));

COMMENT ON COLUMN public.checklist_plantilla_items.momento IS
  'envio = hace falta para mandar el trámite a la prepaga; post_aprobacion = llega después de que el admin aprueba y gatea la liquidación.';

ALTER TABLE public.alta_items
  ADD COLUMN IF NOT EXISTS momento text NOT NULL DEFAULT 'envio'
  CONSTRAINT alta_items_momento_check
    CHECK (momento IN ('envio', 'post_aprobacion'));

COMMENT ON COLUMN public.alta_items.momento IS
  'Snapshot de checklist_plantilla_items.momento al iniciar el alta.';

-- ---------------------------------------------------------------------------
-- La constancia de derivación de aportes (el mismo papel que la plantilla
-- llamaba "Constancia de opción de cambio") pasa a post-aprobación en Sancor
-- desregulado, y se replica al alta piloto que ya la tenía snapshoteada.
-- ---------------------------------------------------------------------------
UPDATE public.checklist_plantilla_items it
SET momento = 'post_aprobacion',
    etiqueta = 'Constancia de derivación de aportes'
FROM public.checklist_plantillas pl
JOIN public.prepagas p ON p.id = pl.prepaga_id
WHERE it.plantilla_id = pl.id
  AND p.slug = 'sancor-salud'
  AND pl.tipo_alta = 'relacion_dependencia'
  AND it.etiqueta = 'Constancia de opción de cambio';

UPDATE public.alta_items
SET momento = 'post_aprobacion',
    etiqueta = 'Constancia de derivación de aportes'
WHERE etiqueta = 'Constancia de opción de cambio';

-- ---------------------------------------------------------------------------
-- El gate de envío pasa a mirar SOLO los ítems del momento 'envio'.
-- Sin esto, agregar un ítem post-aprobación bloquearía el envío para siempre.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.altas_guard_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_faltantes  integer;
  v_es_admin   boolean;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- service_role / migraciones: ver el trade-off en 20260827_altas_guard_estado.sql
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_es_admin := public.auth_is_admin();

  IF NEW.estado IN ('aprobada', 'rechazada') AND NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede aprobar o rechazar un alta'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.estado = 'enviada' AND NOT v_es_admin THEN

    IF NEW.tipo_alta IS NULL THEN
      RAISE EXCEPTION 'Falta el tipo de alta: define la escala comisional'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.cuota IS NULL OR NEW.cuota <= 0 THEN
      RAISE EXCEPTION 'Falta la cuota del trámite (debe ser mayor a cero)'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) INTO v_faltantes
    FROM public.alta_items
    WHERE alta_id = NEW.id AND requerido AND NOT completado
      AND momento = 'envio';

    IF v_faltantes > 0 THEN
      RAISE EXCEPTION 'Faltan % item(s) requeridos para enviar', v_faltantes
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.alta_integrantes
      WHERE alta_id = NEW.id AND rol = 'titular'
        AND (dni IS NOT NULL OR cuil IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'El titular no tiene DNI ni CUIL cargado'
        USING ERRCODE = 'check_violation';
    END IF;

  END IF;

  RETURN NEW;
END
$fn$;

-- ---------------------------------------------------------------------------
-- No hay comisión sin los documentos post-aprobación.
-- La regla vive en la base y no solo en pasarALiquidacion() por la misma razón
-- que el guard de estado: si mañana aparece otro código que inserte comisiones,
-- la plata no se devenga sin el papel que la respalda.
--
-- MISMO TRADE-OFF: se saltea con auth.uid() IS NULL (service_role, migraciones).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comisiones_guard_post_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_faltantes integer;
BEGIN
  IF auth.uid() IS NULL OR NEW.alta_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_faltantes
  FROM public.alta_items
  WHERE alta_id = NEW.alta_id AND requerido AND NOT completado
    AND momento = 'post_aprobacion';

  IF v_faltantes > 0 THEN
    RAISE EXCEPTION 'No se puede generar la comisión: faltan % documento(s) posteriores a la aprobación', v_faltantes
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS comisiones_guard_post_aprobacion ON public.comisiones;
CREATE TRIGGER comisiones_guard_post_aprobacion
  BEFORE INSERT ON public.comisiones
  FOR EACH ROW EXECUTE FUNCTION public.comisiones_guard_post_aprobacion();
