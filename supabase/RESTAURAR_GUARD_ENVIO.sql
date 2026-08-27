-- =============================================================================
-- CORRER DESPUÉS DEL DEPLOY — restaura el gate de completitud del envío
-- -----------------------------------------------------------------------------
-- Contexto: el 2026-08-27 las migraciones se aplicaron a producción antes de
-- que el frontend estuviera desplegado. El trigger `altas_guard_estado` con el
-- gate de completitud rechazaba el envío de altas incompletas, pero la UI vieja
-- no sabe leer ese rechazo y le mostraba al asesor un error crudo de Postgres.
--
-- Como mitigación se dejó en producción una versión reducida de la función,
-- que conserva la regla de seguridad (aprobar/rechazar = solo admin) y saltea
-- la validación de completitud.
--
-- ESTE ARCHIVO NO ESTÁ EN supabase/migrations/ a propósito: la migración
-- 20260827_4_alta_items_momento.sql ya contiene esta versión completa, que es
-- el estado deseado. Esto es solo para volver producción a ese estado sin
-- reaplicar toda la migración.
--
-- Correr una vez que /altas/[id] con el listado de faltantes esté en Vercel.
-- Verificar antes: que un asesor vea la lista de pendientes en el detalle del
-- alta. Si la ve, el rechazo de la base ya no lo va a sorprender.
-- =============================================================================

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

  -- service_role / migraciones: trade-off documentado en 20260827_3.
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

COMMENT ON FUNCTION public.altas_guard_estado() IS
  'Gate de transiciones de estado de un alta. Aprobar/rechazar = solo admin. Enviar = tramite completo (salvo admin). Se saltea con auth.uid() IS NULL (service_role).';
