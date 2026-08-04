-- =============================================================================
-- Alta: carpeta de Google Drive por trámite + integrantes + datos comerciales
-- -----------------------------------------------------------------------------
-- Cada alta genera una carpeta en Drive (bajo la carpeta de su prepaga) donde
-- se sube la documentación desde el CRM. Además se capturan los datos por
-- integrante (titular + grupo familiar) y los datos comerciales del trámite
-- para poder generar el "resumen del trámite" que se envía a procesar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. altas: carpeta de Drive + datos comerciales del trámite
-- ---------------------------------------------------------------------------
ALTER TABLE public.altas
  ADD COLUMN IF NOT EXISTS drive_folder_id    text,
  ADD COLUMN IF NOT EXISTS drive_folder_url   text,
  ADD COLUMN IF NOT EXISTS plan_codigo        text,     -- ej: GA1506
  ADD COLUMN IF NOT EXISTS condicion          text,     -- ej: desregulados / particular / monotributo
  ADD COLUMN IF NOT EXISTS cantidad_capitas   integer,
  ADD COLUMN IF NOT EXISTS cuota              numeric(12,2),
  ADD COLUMN IF NOT EXISTS aportes_promedio   numeric(12,2),
  ADD COLUMN IF NOT EXISTS sueldo_bruto       numeric(12,2),
  ADD COLUMN IF NOT EXISTS periodo_aportes    text,     -- ej: JUNIO 2026
  ADD COLUMN IF NOT EXISTS resumen_texto      text,     -- último resumen generado (cache)
  ADD COLUMN IF NOT EXISTS resumen_drive_id   text,     -- id del documento resumen en Drive
  ADD COLUMN IF NOT EXISTS resumen_drive_url  text;

COMMENT ON COLUMN public.altas.drive_folder_id IS
  'ID de la carpeta de Google Drive del trámite (creada bajo prepagas.drive_folder_id). Debe vivir en una Unidad Compartida para que el service account pueda escribir.';

-- ---------------------------------------------------------------------------
-- 2. alta_items: referencia al archivo subido a Drive
-- ---------------------------------------------------------------------------
ALTER TABLE public.alta_items
  ADD COLUMN IF NOT EXISTS drive_file_id   text,
  ADD COLUMN IF NOT EXISTS drive_file_url  text;

-- ---------------------------------------------------------------------------
-- 3. alta_integrantes: titular + grupo familiar del trámite
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alta_integrantes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alta_id      uuid NOT NULL REFERENCES public.altas ON DELETE CASCADE,
  rol          text NOT NULL DEFAULT 'titular',  -- titular | conyuge | hijo | adherente
  orden        integer NOT NULL DEFAULT 0,
  nombre       text,
  dni          text,
  cuil         text,
  fecha_nac    date,
  edad         integer,
  peso_kg      numeric(5,1),
  altura_cm    numeric(5,1),
  -- Datos de contacto (principalmente del titular)
  domicilio    text,
  telefono     text,
  email        text,
  parentesco   text,
  observaciones text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alta_integrantes_alta_id_idx ON public.alta_integrantes (alta_id);

ALTER TABLE public.alta_integrantes ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total (mismo patrón que alta_items)
CREATE POLICY "alta_integrantes_admin_all" ON public.alta_integrantes
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Asesor: solo integrantes de sus propias altas
CREATE POLICY "alta_integrantes_asesor_all" ON public.alta_integrantes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.altas
      WHERE altas.id = alta_integrantes.alta_id
      AND altas.asesor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altas
      WHERE altas.id = alta_integrantes.alta_id
      AND altas.asesor_id = auth.uid()
    )
  );

CREATE OR REPLACE TRIGGER alta_integrantes_updated_at
  BEFORE UPDATE ON public.alta_integrantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Plantilla de checklist — SANCOR SALUD (piloto)
--    Datos (tipo texto/numero/fecha) + archivos requeridos del trámite.
--    Editable luego desde /admin/prepagas.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_prepaga_id uuid;
  v_plantilla_id uuid;
BEGIN
  SELECT id INTO v_prepaga_id FROM public.prepagas WHERE slug = 'sancor-salud' LIMIT 1;

  IF v_prepaga_id IS NOT NULL THEN
    -- Plantilla estándar (tipo_alta NULL). Solo se crea si no existe una activa.
    SELECT id INTO v_plantilla_id
    FROM public.checklist_plantillas
    WHERE prepaga_id = v_prepaga_id AND tipo_alta IS NULL AND activa = true
    LIMIT 1;

    IF v_plantilla_id IS NULL THEN
      INSERT INTO public.checklist_plantillas (prepaga_id, nombre, tipo_alta, activa)
      VALUES (v_prepaga_id, 'Trámite Sancor Salud', NULL, true)
      RETURNING id INTO v_plantilla_id;

      INSERT INTO public.checklist_plantilla_items (plantilla_id, etiqueta, tipo_dato, requerido, orden) VALUES
        -- Archivos requeridos (confirmar/ajustar la lista real con la agencia)
        (v_plantilla_id, 'DNI titular (frente y dorso)',        'archivo', true,  10),
        (v_plantilla_id, 'DNI integrantes (frente y dorso)',    'archivo', true,  20),
        (v_plantilla_id, 'Últimos 3 recibos de sueldo',         'archivo', true,  30),
        (v_plantilla_id, 'Constancia de CUIL',                  'archivo', true,  40),
        (v_plantilla_id, 'Formulario de opción / traspaso firmado', 'archivo', true, 50),
        (v_plantilla_id, 'DDJJ de salud firmada',               'archivo', true,  60),
        -- Datos del trámite
        (v_plantilla_id, 'Domicilio del titular',               'texto',   true,  70),
        (v_plantilla_id, 'Email del titular',                   'texto',   true,  80),
        (v_plantilla_id, 'Teléfono del titular',                'texto',   true,  90),
        (v_plantilla_id, 'Peso del titular (kg)',               'numero',  true, 100),
        (v_plantilla_id, 'Altura del titular (cm)',             'numero',  true, 110);
    END IF;
  END IF;
END $$;
