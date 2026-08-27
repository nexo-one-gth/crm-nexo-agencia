-- =============================================================================
-- Guard de estado de altas — a nivel base, no solo en la server action
-- -----------------------------------------------------------------------------
-- Cierra dos agujeros que hasta hoy dependían de que TODO el código pasara por
-- actualizarEstadoAlta():
--
--   1. "Solo un admin aprueba o rechaza" vivía únicamente en la server action.
--      La policy altas_update deja al asesor dueño escribir CUALQUIER columna,
--      estado incluido. Un update directo contra la API REST con el token del
--      asesor la salteaba — y como aprobar dispara la comisión automática, un
--      asesor podía auto-aprobarse una venta y generarse la comisión.
--      (Señalado en ANALISIS_TRAZABILIDAD_PREPAGAS.md §4, sin cerrar.)
--
--   2. "Enviada" no significaba nada: era una opción de un <select>. El alta
--      testigo de Sancor está en `enviada` con 0 de 8 documentos cargados.
--
-- Por qué un trigger y no otra policy: una policy de UPDATE no puede mirar
-- filas de otras tablas por cada transición ni comparar OLD vs NEW. El trigger
-- es el único lugar donde la regla vale para todos los code paths.
--
-- TRADE-OFF EXPLÍCITO: el guard se saltea cuando auth.uid() IS NULL, es decir
-- para el service_role y para las migraciones. Es deliberado (si no, ninguna
-- corrección de datos ni job de backoffice podría tocar `estado`), y se apoya
-- en que la service_role key nunca llega al cliente. Si algún día una API route
-- pública usara service_role para mover altas, este guard no la cubre.
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
  -- Solo nos importan los cambios de estado.
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- service_role / migraciones: ver TRADE-OFF en el encabezado.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_es_admin := public.auth_is_admin();

  -- 1. Aprobar / rechazar: decisión del admin, no del asesor que vendió.
  IF NEW.estado IN ('aprobada', 'rechazada') AND NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede aprobar o rechazar un alta'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Enviar a procesar: el trámite tiene que estar completo.
  --    El admin puede forzar (escape hatch para casos de operación); el asesor
  --    no, que es justamente quien envía.
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
    WHERE alta_id = NEW.id AND requerido AND NOT completado;

    IF v_faltantes > 0 THEN
      RAISE EXCEPTION 'Faltan % item(s) requeridos del checklist', v_faltantes
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

DROP TRIGGER IF EXISTS altas_guard_estado ON public.altas;
CREATE TRIGGER altas_guard_estado
  BEFORE UPDATE OF estado ON public.altas
  FOR EACH ROW EXECUTE FUNCTION public.altas_guard_estado();

COMMENT ON FUNCTION public.altas_guard_estado() IS
  'Gate de transiciones de estado de un alta. Aprobar/rechazar = solo admin. Enviar = trámite completo (salvo admin). Se saltea con auth.uid() IS NULL (service_role).';
