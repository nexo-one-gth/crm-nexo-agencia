-- ---------------------------------------------------------------------------
-- prepaga_tarifas — matriz de precios del cotizador interno (Premedic).
--
-- Esta tabla ya existía en la base pero nunca tuvo migración versionada.
-- Este archivo documenta su esquema real (idempotente) y agrega un índice
-- único parcial para garantizar una sola fila VIGENTE por combinación.
--
-- Cada fila = plan × zona × modalidad × composición × banda de edad → precio.
-- El cotizador toma como vigente lo que tiene vigencia_hasta IS NULL.
-- La actualización mensual cierra el lote anterior (setea vigencia_hasta)
-- e inserta el nuevo con vigencia_desde = 1° del mes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.prepaga_tarifas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id        uuid NOT NULL REFERENCES public.prepagas(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES public.prepaga_planes(id) ON DELETE CASCADE,
  zona              text NOT NULL,          -- 'amba' | 'interior'
  modalidad         text NOT NULL,          -- 'directo' | 'desregulado'
  composicion       text NOT NULL,          -- individual, matrimonio, matrimonio_1hijo,
                                             -- matrimonio_2hijos, matrimonio_3hijos,
                                             -- adicional_menor1, adicional_menor25,
                                             -- recargo_60_64_1, recargo_60_64_2
  edad_titular_min  integer,                -- NULL en adicionales/recargos
  edad_titular_max  integer,
  precio            numeric NOT NULL,
  vigencia_desde    date NOT NULL DEFAULT '2026-06-01',
  vigencia_hasta    date,                   -- NULL = fila vigente
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Índice de búsqueda que usa calcularTarifaPremedic()
CREATE INDEX IF NOT EXISTS idx_tarifas_plan_zona_modalidad
  ON public.prepaga_tarifas (plan_id, zona, modalidad, composicion, edad_titular_min);

-- Integridad: una sola fila VIGENTE por combinación (evita duplicar al cargar).
-- coalesce(-1) para tratar las bandas NULL (adicionales) como una clave estable.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tarifas_vigente
  ON public.prepaga_tarifas (
    prepaga_id, plan_id, zona, modalidad, composicion,
    coalesce(edad_titular_min, -1), coalesce(edad_titular_max, -1)
  )
  WHERE vigencia_hasta IS NULL;

-- RLS: lectura para todos los autenticados; escritura solo admin/admin_principal.
ALTER TABLE public.prepaga_tarifas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prepaga_tarifas'
      AND policyname = 'Tarifas visibles para autenticados'
  ) THEN
    CREATE POLICY "Tarifas visibles para autenticados" ON public.prepaga_tarifas
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prepaga_tarifas'
      AND policyname = 'Solo admins modifican tarifas'
  ) THEN
    CREATE POLICY "Solo admins modifican tarifas" ON public.prepaga_tarifas
      FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role = ANY (ARRAY['admin','admin_principal']))
      );
  END IF;
END $$;
