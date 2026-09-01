-- =============================================================================
-- Storage de altas: alinear el bucket con el modelo de visibilidad del CRM
-- -----------------------------------------------------------------------------
-- El bucket `altas-adjuntos` y sus políticas existen desde junio
-- (20260610_modulo_prepagas.sql) pero nunca se usaron: en agosto la subida se
-- hizo contra Google Drive. Ahora los documentos del trámite vuelven acá, así
-- que las políticas pasan a ser el mecanismo real de aislamiento y hay que
-- corregir dos cosas.
--
-- HUECO 1 — un líder no ve los adjuntos de su equipo.
--   La policy de SELECT pregunta `altas.asesor_id = auth.uid()`: solo el dueño.
--   El resto del CRM resuelve la visibilidad con auth_asesores_visibles(), que
--   devuelve el propio uid más los asesores a cargo. Es exactamente el patrón
--   de bug que CLAUDE.md marca como el más frecuente del proyecto: una condición
--   escrita a mano en vez de derivarla del dato. Un supervisor que abre un alta
--   de su equipo vería el checklist completo y ningún archivo.
--
-- HUECO 2 — no se puede corregir un archivo mal subido.
--   Solo hay INSERT y SELECT para el asesor. Sin UPDATE ni DELETE, subir el DNI
--   equivocado es irreversible salvo que intervenga un admin. Con fotos sacadas
--   desde el celular eso va a pasar seguido.
--
-- La escritura se acota por estado: mientras el trámite está en curso
-- (en_proceso, observada) o esperando la documentación posterior (aprobada).
-- En `enviada` el asesor deja de tocar los documentos —ya salieron a la
-- prepaga— y en `rechazada` no tiene sentido. El admin no tiene esa restricción:
-- su policy es FOR ALL y no mira el estado.
-- =============================================================================

-- Convención de path: <alta_id>/<item_id>.<ext>
-- El primer segmento es lo que amarra el objeto al alta, y de ahí sale el
-- permiso. No cambiar sin actualizar las cuatro policies de abajo.

-- ---------------------------------------------------------------------------
-- Lectura: la misma visibilidad que tiene el alta
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "altas_adjuntos_asesor_select" ON storage.objects;

CREATE POLICY "altas_adjuntos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas a
      WHERE a.id::text = (string_to_array(objects.name, '/'))[1]
        AND a.asesor_id IN (SELECT public.auth_asesores_visibles())
    )
  );

-- ---------------------------------------------------------------------------
-- Escritura del asesor dueño, mientras el trámite lo admite
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "altas_adjuntos_asesor_insert" ON storage.objects;

CREATE POLICY "altas_adjuntos_asesor_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas a
      WHERE a.id::text = (string_to_array(objects.name, '/'))[1]
        AND a.asesor_id = auth.uid()
        AND a.estado IN ('en_proceso', 'observada', 'aprobada')
    )
  );

-- UPDATE: necesario para el upsert de Supabase Storage cuando se reemplaza un
-- archivo con el mismo nombre.
CREATE POLICY "altas_adjuntos_asesor_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas a
      WHERE a.id::text = (string_to_array(objects.name, '/'))[1]
        AND a.asesor_id = auth.uid()
        AND a.estado IN ('en_proceso', 'observada', 'aprobada')
    )
  )
  WITH CHECK (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas a
      WHERE a.id::text = (string_to_array(objects.name, '/'))[1]
        AND a.asesor_id = auth.uid()
        AND a.estado IN ('en_proceso', 'observada', 'aprobada')
    )
  );

-- DELETE: hace falta cuando el reemplazo cambia de extensión (una foto .jpg por
-- un .pdf): el objeto viejo tiene otro nombre y el upsert no lo pisa.
CREATE POLICY "altas_adjuntos_asesor_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas a
      WHERE a.id::text = (string_to_array(objects.name, '/'))[1]
        AND a.asesor_id = auth.uid()
        AND a.estado IN ('en_proceso', 'observada', 'aprobada')
    )
  );
