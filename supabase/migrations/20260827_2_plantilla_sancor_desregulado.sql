-- =============================================================================
-- Plantilla real: SANCOR SALUD × desregulado (relación de dependencia)
-- -----------------------------------------------------------------------------
-- Piloto del modelo "una plantilla por (prepaga × condición)". Hasta hoy las 10
-- prepagas compartían una plantilla genérica "Alta estándar" de 8 ítems, sin un
-- solo ítem de sección `datos` y sin `resumen_template` en toda la base: el
-- motor existía y estaba vacío.
--
-- El contenido sale del expediente real de un alta enviada a Sancor
-- (caso TELLERIA CLOSSA, 2026-08): 6 documentos + los datos de la constancia de
-- opción de cambio de la SSSalud.
--
-- "Desregulado" NO es un tipo_alta nuevo: se mapea a `relacion_dependencia`,
-- que es el segmento con el que Sancor liquida (Sancor no tiene regla `pmo`, y
-- en Premedic ese mismo segmento está anotado como "Desregulado superador").
-- =============================================================================

DO $mig$
DECLARE
  v_prepaga_id   uuid;
  v_plantilla_id uuid;
BEGIN
  SELECT id INTO v_prepaga_id FROM public.prepagas WHERE slug = 'sancor-salud';
  IF v_prepaga_id IS NULL THEN
    RAISE NOTICE 'Prepaga sancor-salud no encontrada — migración omitida';
    RETURN;
  END IF;

  -- Idempotencia: si ya existe la plantilla de este tipo, se reusa y se limpian
  -- sus ítems para dejarla exactamente como declara esta migración.
  SELECT id INTO v_plantilla_id
  FROM public.checklist_plantillas
  WHERE prepaga_id = v_prepaga_id AND tipo_alta = 'relacion_dependencia' AND activa = true;

  IF v_plantilla_id IS NULL THEN
    INSERT INTO public.checklist_plantillas (prepaga_id, nombre, tipo_alta, activa)
    VALUES (v_prepaga_id, 'Sancor Salud — Desregulado', 'relacion_dependencia', true)
    RETURNING id INTO v_plantilla_id;
  ELSE
    DELETE FROM public.checklist_plantilla_items WHERE plantilla_id = v_plantilla_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- DOCUMENTOS — los 6 requeridos son exactamente los del expediente real.
  -- DNI frente y dorso van separados: en la carpeta de Drive son dos archivos,
  -- y como un ítem = un archivo en Drive, pedirlos juntos hace que el segundo
  -- pise al primero.
  -- -------------------------------------------------------------------------
  INSERT INTO public.checklist_plantilla_items
    (plantilla_id, etiqueta, tipo_dato, requerido, orden, seccion) VALUES
    (v_plantilla_id, 'DNI titular (frente)',            'archivo', true,  10, 'documentos'),
    (v_plantilla_id, 'DNI titular (dorso)',             'archivo', true,  20, 'documentos'),
    (v_plantilla_id, 'Recibo de sueldo',                'archivo', true,  30, 'documentos'),
    (v_plantilla_id, 'Constancia de opción de cambio',  'archivo', true,  40, 'documentos'),
    (v_plantilla_id, 'Cotización aprobada',             'archivo', true,  50, 'documentos'),
    (v_plantilla_id, 'Medio de pago (tarjeta o CBU)',   'archivo', true,  60, 'documentos'),
    (v_plantilla_id, 'DNI grupo familiar',              'archivo', false, 70, 'documentos'),
    (v_plantilla_id, 'DDJJ de salud firmada',           'archivo', false, 80, 'documentos');

  -- -------------------------------------------------------------------------
  -- DATOS — específicos del desregulado. Salen de la constancia de opción de
  -- cambio de la SSSalud y no tienen columna propia en `altas` a propósito:
  -- son datos de esta condición en esta prepaga, no del modelo general.
  -- Las etiquetas definen la clave del template ({{datos.<etiqueta>}}): la clave
  -- se deriva quitando acentos y pasando a snake_case (ver claveEtiqueta /
  -- alta-resumen.ts), así que "Código postal" -> {{datos.codigo_postal}}.
  -- Renombrar un ítem acá rompe el resumen.
  -- -------------------------------------------------------------------------
  INSERT INTO public.checklist_plantilla_items
    (plantilla_id, etiqueta, tipo_dato, requerido, orden, seccion) VALUES
    (v_plantilla_id, 'Formulario de opción',        'texto',  true,  100, 'datos'),
    (v_plantilla_id, 'Fecha de inicio de vigencia', 'fecha',  true,  110, 'datos'),
    (v_plantilla_id, 'Obra social origen',          'texto',  true,  120, 'datos'),
    (v_plantilla_id, 'Obra social destino',         'texto',  true,  130, 'datos'),
    (v_plantilla_id, 'CUIT empleador',              'texto',  true,  140, 'datos'),
    (v_plantilla_id, 'Código postal',               'texto',  true,  150, 'datos'),
    (v_plantilla_id, 'Provincia',                   'texto',  true,  160, 'datos'),
    (v_plantilla_id, 'Localidad',                   'texto',  false, 170, 'datos');

  -- -------------------------------------------------------------------------
  -- RESUMEN — reproduce el formato que la agencia ya venía escribiendo a mano
  -- (el "info alta.txt" del expediente) y le agrega el bloque de desregulado.
  -- La condición va literal ("DESREGULADOS") porque esta plantilla ES la de esa
  -- condición: no depende de cómo se etiquete tipo_alta en pantalla.
  -- -------------------------------------------------------------------------
  UPDATE public.checklist_plantillas
  SET resumen_template = $tpl$PREPAGA SANCOR SALUD

PLAN {{plan_codigo}}
DESREGULADOS
{{capitas}} CÁPITAS

Cuota {{cuota}}

----------------------------------------

Monto aprox. de Aportes promedio calculados sobre el mes de {{periodo}}
{{aportes}} (SUELDO BRUTO {{sueldo_bruto}})

----------------------------------------
Datos TITULAR
Nombre: {{titular_nombre}}
DNI: {{titular_dni}}
Cuil: {{titular_cuil}}
Edad: {{titular_edad}} AÑOS
Peso: {{titular_peso}} KG
Altura: {{titular_altura}} CM
Domicilio: {{titular_domicilio}}
Tel: {{titular_tel}}
Email: {{titular_email}}
{{integrantes}}
----------------------------------------
OPCIÓN DE CAMBIO (DESREGULADO)
Formulario N°: {{datos.formulario_de_opcion}}
Inicio de vigencia: {{datos.fecha_de_inicio_de_vigencia}}
Obra social origen: {{datos.obra_social_origen}}
Obra social destino: {{datos.obra_social_destino}}
CUIT empleador: {{datos.cuit_empleador}}
Localidad: {{datos.localidad}} - {{datos.provincia}} (CP {{datos.codigo_postal}})$tpl$
  WHERE id = v_plantilla_id;

END $mig$;
