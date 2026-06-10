-- =============================================================================
-- MIGRACIÓN: Módulo de Prepagas
-- Fecha: 2026-06-10
-- Tablas: prepagas, prepaga_planes, prepaga_asesores, prepaga_eventos,
--         checklist_plantillas, checklist_plantilla_items, altas, alta_items
-- También: vista segura de prepaga_asesores, storage bucket, FK en leads
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLA: prepagas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepagas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  slug            text NOT NULL,
  logo_url        text,
  activa          boolean NOT NULL DEFAULT true,
  tipo_cotizador  text NOT NULL DEFAULT 'externo'
                    CHECK (tipo_cotizador IN ('integrado','externo','pdf','manual')),
  cotizador_url   text,
  notas_admin     text,
  orden           int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prepagas_nombre_unique UNIQUE (nombre),
  CONSTRAINT prepagas_slug_unique   UNIQUE (slug)
);

ALTER TABLE public.prepagas ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados leen prepagas activas
CREATE POLICY "prepagas_select" ON public.prepagas
  FOR SELECT TO authenticated
  USING (activa = true OR public.auth_is_admin());

-- Solo admin puede escribir
CREATE POLICY "prepagas_admin_write" ON public.prepagas
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- SEED: 10 prepagas
-- ---------------------------------------------------------------------------
INSERT INTO public.prepagas (nombre, slug, activa, tipo_cotizador, orden) VALUES
  ('PREMEDIC',          'premedic',          true, 'externo', 1),
  ('SANCOR SALUD',      'sancor-salud',      true, 'externo', 2),
  ('AVALIAN',           'avalian',           true, 'externo', 3),
  ('MEDIFE',            'medife',            true, 'externo', 4),
  ('OMINT',             'omint',             true, 'externo', 5),
  ('DOCTOR RED',        'doctor-red',        true, 'externo', 6),
  ('HOMINIS',           'hominis',           true, 'externo', 7),
  ('GALENO',            'galeno',            true, 'externo', 8),
  ('SWISS MEDICAL',     'swiss-medical',     true, 'externo', 9),
  ('PREVENCIÓN SALUD',  'prevencion-salud',  true, 'externo', 10)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- TABLA: prepaga_planes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepaga_planes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id  uuid NOT NULL REFERENCES public.prepagas ON DELETE CASCADE,
  nombre      text NOT NULL,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  orden       int NOT NULL DEFAULT 0,
  CONSTRAINT prepaga_planes_unique UNIQUE (prepaga_id, nombre)
);

ALTER TABLE public.prepaga_planes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prepaga_planes_select" ON public.prepaga_planes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "prepaga_planes_admin_write" ON public.prepaga_planes
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- TABLA: prepaga_asesores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepaga_asesores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id       uuid NOT NULL REFERENCES public.prepagas ON DELETE CASCADE,
  asesor_id        uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  comision_pct     numeric,
  codigo_productor text,
  credenciales     jsonb NOT NULL DEFAULT '{}',
  activo           boolean NOT NULL DEFAULT true,
  CONSTRAINT prepaga_asesores_unique UNIQUE (prepaga_id, asesor_id)
);

ALTER TABLE public.prepaga_asesores ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total (incluye credenciales)
CREATE POLICY "prepaga_asesores_admin_all" ON public.prepaga_asesores
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Asesor: solo ve su propia fila
CREATE POLICY "prepaga_asesores_asesor_select" ON public.prepaga_asesores
  FOR SELECT TO authenticated
  USING (asesor_id = auth.uid());

-- Vista segura sin credenciales para el cliente
CREATE OR REPLACE VIEW public.prepaga_asesores_safe AS
  SELECT
    id,
    prepaga_id,
    asesor_id,
    comision_pct,
    codigo_productor,
    activo
  FROM public.prepaga_asesores;

COMMENT ON VIEW public.prepaga_asesores_safe IS
  'Vista sin credenciales — usar en queries client-side. Las credenciales se inyectan server-side al abrir cotizador.';

-- ---------------------------------------------------------------------------
-- TABLA: prepaga_eventos (calendarios de cierre y pagos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepaga_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id  uuid NOT NULL REFERENCES public.prepagas ON DELETE CASCADE,
  fecha       date NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('cierre_comisional','cierre_vigencia','pago')),
  segmento    text,
  nota        text,
  mes_periodo text NOT NULL,
  created_by  uuid REFERENCES public.profiles,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prepaga_eventos ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver y gestionar eventos
CREATE POLICY "prepaga_eventos_admin_all" ON public.prepaga_eventos
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- TABLA: checklist_plantillas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_plantillas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id uuid NOT NULL REFERENCES public.prepagas ON DELETE CASCADE,
  nombre     text NOT NULL DEFAULT 'Alta estándar',
  tipo_alta  text,
  activa     boolean NOT NULL DEFAULT true
);

ALTER TABLE public.checklist_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_plantillas_select" ON public.checklist_plantillas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "checklist_plantillas_admin_write" ON public.checklist_plantillas
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- TABLA: checklist_plantilla_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_plantilla_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES public.checklist_plantillas ON DELETE CASCADE,
  etiqueta     text NOT NULL,
  tipo_dato    text NOT NULL DEFAULT 'check'
                 CHECK (tipo_dato IN ('check','texto','archivo','fecha','numero')),
  requerido    boolean NOT NULL DEFAULT true,
  orden        int NOT NULL DEFAULT 0
);

ALTER TABLE public.checklist_plantilla_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_plantilla_items_select" ON public.checklist_plantilla_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "checklist_plantilla_items_admin_write" ON public.checklist_plantilla_items
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- SEED: plantillas y items base por cada prepaga
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  prep_id   uuid;
  plant_id  uuid;
BEGIN
  FOR prep_id IN SELECT id FROM public.prepagas LOOP
    INSERT INTO public.checklist_plantillas (prepaga_id, nombre, tipo_alta, activa)
    VALUES (prep_id, 'Alta estándar', NULL, true)
    RETURNING id INTO plant_id;

    INSERT INTO public.checklist_plantilla_items (plantilla_id, etiqueta, tipo_dato, requerido, orden) VALUES
      (plant_id, 'DNI frente y dorso',       'archivo', true,  1),
      (plant_id, 'CUIL del titular',          'texto',   true,  2),
      (plant_id, 'Recibo de sueldo',          'archivo', false, 3),
      (plant_id, 'PDF cotización aprobada',   'archivo', true,  4),
      (plant_id, 'Solicitud de opción',        'archivo', true,  5),
      (plant_id, 'Formulario de alta firmado', 'archivo', true,  6),
      (plant_id, 'Número de trámite',          'texto',   false, 7),
      (plant_id, 'Observaciones adicionales',  'texto',   false, 8);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- TABLA: altas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.altas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.leads ON DELETE RESTRICT,
  prepaga_id   uuid NOT NULL REFERENCES public.prepagas,
  plan_id      uuid REFERENCES public.prepaga_planes,
  asesor_id    uuid NOT NULL REFERENCES public.profiles,
  plantilla_id uuid REFERENCES public.checklist_plantillas,
  tipo_alta    text,
  estado       text NOT NULL DEFAULT 'en_proceso'
                 CHECK (estado IN ('en_proceso','enviada','observada','aprobada','rechazada')),
  enviada_at   timestamptz,
  observaciones text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.altas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "altas_admin_all" ON public.altas
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY "altas_asesor_select" ON public.altas
  FOR SELECT TO authenticated
  USING (asesor_id = auth.uid());

CREATE POLICY "altas_asesor_insert" ON public.altas
  FOR INSERT TO authenticated
  WITH CHECK (asesor_id = auth.uid());

CREATE POLICY "altas_asesor_update" ON public.altas
  FOR UPDATE TO authenticated
  USING (asesor_id = auth.uid())
  WITH CHECK (asesor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- TABLA: alta_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alta_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alta_id             uuid NOT NULL REFERENCES public.altas ON DELETE CASCADE,
  plantilla_item_id   uuid REFERENCES public.checklist_plantilla_items,
  etiqueta            text NOT NULL,
  tipo_dato           text NOT NULL,
  requerido           boolean NOT NULL DEFAULT true,
  completado          boolean NOT NULL DEFAULT false,
  valor_texto         text,
  valor_fecha         date,
  valor_numero        numeric,
  archivo_path        text,
  completado_by       uuid REFERENCES public.profiles,
  completado_at       timestamptz
);

ALTER TABLE public.alta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alta_items_admin_all" ON public.alta_items
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY "alta_items_asesor_all" ON public.alta_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.altas
      WHERE altas.id = alta_items.alta_id
      AND altas.asesor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altas
      WHERE altas.id = alta_items.alta_id
      AND altas.asesor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- FK en leads: campo prepaga_id (nullable, sin migrar datos viejos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS prepaga_id uuid REFERENCES public.prepagas;

-- ---------------------------------------------------------------------------
-- STORAGE: bucket privado altas-adjuntos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'altas-adjuntos',
  'altas-adjuntos',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: asesores pueden subir y leer sus propias altas
CREATE POLICY "altas_adjuntos_asesor_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'altas-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.altas
      WHERE altas.id::text = (string_to_array(name, '/'))[1]
      AND altas.asesor_id = auth.uid()
    )
  );

CREATE POLICY "altas_adjuntos_asesor_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'altas-adjuntos'
    AND (
      public.auth_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.altas
        WHERE altas.id::text = (string_to_array(name, '/'))[1]
        AND altas.asesor_id = auth.uid()
      )
    )
  );

CREATE POLICY "altas_adjuntos_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'altas-adjuntos' AND public.auth_is_admin())
  WITH CHECK (bucket_id = 'altas-adjuntos' AND public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- updated_at trigger helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER prepagas_updated_at
  BEFORE UPDATE ON public.prepagas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER altas_updated_at
  BEFORE UPDATE ON public.altas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
