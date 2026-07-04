-- Unificación de criterios de comisiones:
-- 1. Origen del dato normalizado en leads (nexo | referido | campania)
-- 2. Reglas de comisión con dimensión origen (NULL = aplica a todos los orígenes)
-- 3. Cierres comisionales (lotes) por prepaga + período, con liquidación por lote
-- 4. Snapshot de origen, lote y % del asesor en cada comisión generada

-- ---------------------------------------------------------------------------
-- 1. LEADS: origen del dato normalizado
--    nexo     → importado desde la importación de datos (Excel/CSV)
--    referido → cargado manualmente por el asesor
--    campania → importado/asignado desde una campaña (el nombre viene de campaign_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS origen text
  CHECK (origen IN ('nexo', 'referido', 'campania'));

-- Backfill de leads existentes según cómo entraron al sistema
UPDATE public.leads SET origen = CASE
  WHEN campaign_id IS NOT NULL THEN 'campania'
  WHEN source IN ('Manual', 'App Asesores') THEN 'referido'
  ELSE 'nexo'
END
WHERE origen IS NULL;

-- ---------------------------------------------------------------------------
-- 2. REGLAS DE COMISIÓN: dimensión origen
--    origen NULL = regla general (aplica a cualquier origen).
--    Una regla con origen específico pisa a la general para ese origen.
-- ---------------------------------------------------------------------------
ALTER TABLE public.prepaga_comision_reglas
  ADD COLUMN IF NOT EXISTS origen text
  CHECK (origen IN ('nexo', 'referido', 'campania'));

-- La unicidad pasa de (prepaga, segmento) a (prepaga, segmento, origen)
ALTER TABLE public.prepaga_comision_reglas
  DROP CONSTRAINT IF EXISTS prepaga_comision_reglas_unique;

CREATE UNIQUE INDEX IF NOT EXISTS prepaga_comision_reglas_prepaga_segmento_origen_uni
  ON public.prepaga_comision_reglas (prepaga_id, segmento, COALESCE(origen, '*'));

-- ---------------------------------------------------------------------------
-- 3. CIERRES COMISIONALES (lotes)
--    Un lote agrupa las ventas aprobadas de una prepaga en un período.
--    Ciclo: abierto → cerrado → liquidado. Al liquidar el lote se liquidan
--    todas sus comisiones.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cierres_comisionales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id          uuid NOT NULL REFERENCES public.prepagas(id) ON DELETE CASCADE,
  mes_periodo         text NOT NULL CHECK (mes_periodo ~ '^\d{4}-\d{2}$'),
  estado              text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado', 'liquidado')),
  fecha_cierre        date,
  fecha_pago_estimada date,
  cerrado_at          timestamptz,
  cerrado_by          uuid REFERENCES public.profiles(id),
  liquidado_at        timestamptz,
  liquidado_by        uuid REFERENCES public.profiles(id),
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cierres_comisionales_prepaga_estado_idx
  ON public.cierres_comisionales (prepaga_id, estado);

ALTER TABLE public.cierres_comisionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cierres visibles para todos los autenticados"
  ON public.cierres_comisionales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin gestiona cierres comisionales"
  ON public.cierres_comisionales FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- 4. COMISIONES: snapshot de origen, lote y % del asesor
--    comision_pct_asesor: % que le corresponde al asesor sobre la comisión
--    de la regla (viene de prepaga_asesores.comision_pct; NULL = 100%).
-- ---------------------------------------------------------------------------
ALTER TABLE public.comisiones
  ADD COLUMN IF NOT EXISTS origen text,
  ADD COLUMN IF NOT EXISTS cierre_id uuid REFERENCES public.cierres_comisionales(id),
  ADD COLUMN IF NOT EXISTS comision_pct_asesor numeric;

CREATE INDEX IF NOT EXISTS comisiones_cierre_idx ON public.comisiones (cierre_id);

-- Backfill: crear un lote abierto por prepaga + mes para las comisiones existentes
INSERT INTO public.cierres_comisionales (prepaga_id, mes_periodo)
SELECT DISTINCT c.prepaga_id, to_char(c.created_at, 'YYYY-MM')
FROM public.comisiones c
WHERE c.cierre_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cierres_comisionales cc
    WHERE cc.prepaga_id = c.prepaga_id
      AND cc.mes_periodo = to_char(c.created_at, 'YYYY-MM')
  );

UPDATE public.comisiones c
SET cierre_id = cc.id
FROM public.cierres_comisionales cc
WHERE c.cierre_id IS NULL
  AND cc.prepaga_id = c.prepaga_id
  AND cc.mes_periodo = to_char(c.created_at, 'YYYY-MM');

-- Backfill del origen desde el lead
UPDATE public.comisiones c
SET origen = COALESCE(l.origen, 'nexo')
FROM public.leads l
WHERE c.origen IS NULL AND l.id = c.lead_id;
