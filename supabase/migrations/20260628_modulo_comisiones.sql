-- Módulo de comisiones: reglas por prepaga (según condiciones comerciales reales)
-- + tabla de comisiones generadas al aprobar una alta + campo sueldo_bruto para segmento PMO.

-- ---------------------------------------------------------------------------
-- Campo nuevo en leads: sueldo bruto (necesario para comisión PMO = % del sueldo)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sueldo_bruto numeric;

-- ---------------------------------------------------------------------------
-- TABLA: prepaga_comision_reglas
-- Una fila por combinación prepaga + segmento. Configurable por el admin.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prepaga_comision_reglas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepaga_id      uuid NOT NULL REFERENCES public.prepagas(id) ON DELETE CASCADE,
  segmento        text NOT NULL CHECK (segmento IN ('particular', 'relacion_dependencia', 'monotributo', 'pmo')),
  tipo_base       text NOT NULL CHECK (tipo_base IN ('valor_plan', 'pct_sueldo_bruto')),
  porcentaje      numeric NOT NULL,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prepaga_comision_reglas_unique UNIQUE (prepaga_id, segmento)
);

ALTER TABLE public.prepaga_comision_reglas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reglas de comisión visibles para todos los autenticados"
  ON public.prepaga_comision_reglas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admin gestiona reglas de comisión"
  ON public.prepaga_comision_reglas FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- TABLA: comisiones
-- Un registro por alta aprobada. Snapshot de la regla aplicada al momento de aprobar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comisiones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alta_id          uuid NOT NULL UNIQUE REFERENCES public.altas(id) ON DELETE CASCADE,
  lead_id          uuid NOT NULL REFERENCES public.leads(id),
  asesor_id        uuid NOT NULL REFERENCES public.profiles(id),
  prepaga_id       uuid NOT NULL REFERENCES public.prepagas(id),
  segmento         text NOT NULL,
  tipo_base        text NOT NULL,
  porcentaje       numeric NOT NULL,
  monto_base       numeric NOT NULL,
  monto_comision   numeric NOT NULL,
  estado           text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'liquidada')),
  liquidada_at     timestamptz,
  liquidada_by     uuid REFERENCES public.profiles(id),
  notas            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Asesor ve sus propias comisiones, admin ve todas"
  ON public.comisiones FOR SELECT
  TO authenticated
  USING (asesor_id = auth.uid() OR public.auth_is_admin());

CREATE POLICY "Solo admin crea y modifica comisiones"
  ON public.comisiones FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ---------------------------------------------------------------------------
-- SEED: reglas de comisión según "Condiciones Comerciales por Prepaga" (NEXO Salud)
-- Solo se cargan las prepagas que ya existen en el sistema. Salud Central no está
-- en el catálogo todavía, queda pendiente de alta.
-- ---------------------------------------------------------------------------

-- AVALIAN: obligatorio (recibo sueldo / monotributo) sin decomisión; voluntario (particular) con 6 meses.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, 'relacion_dependencia', 'valor_plan', 100,
  'Segmento obligatorio. Comisión a 30 días de la vigencia. Sin decomisión.'
FROM public.prepagas WHERE slug = 'avalian'
UNION ALL
SELECT id, 'monotributo', 'valor_plan', 100,
  'Segmento obligatorio. Comisión a 30 días de la vigencia. Sin decomisión.'
FROM public.prepagas WHERE slug = 'avalian'
UNION ALL
SELECT id, 'particular', 'valor_plan', 100,
  'Segmento voluntario/directo. Comisión efectiva solo con factura paga. Decomisión: 6 meses de permanencia con facturas pagas.'
FROM public.prepagas WHERE slug = 'avalian'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;

-- SANCOR SALUD: AMBA, mismo % en los 3 segmentos, decomisión 3 meses.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, seg, 'valor_plan', 100,
  'Ámbito AMBA. Liquidación por lote comisional (~1 mes después del cierre). Decomisión: 3 meses de permanencia con facturas pagas.'
FROM public.prepagas, unnest(ARRAY['relacion_dependencia','monotributo','particular']) AS seg
WHERE slug = 'sancor-salud'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;

-- MEDIFE: ámbito amplio, mismo % en los 3 segmentos, decomisión 3 meses.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, seg, 'valor_plan', 100,
  'Ámbito AMBA + ciudades de PBA/interior habilitadas. Liquidación mensual (20-30), lote = mes calendario, cobra el mes siguiente. Decomisión: 3 meses.'
FROM public.prepagas, unnest(ARRAY['relacion_dependencia','monotributo','particular']) AS seg
WHERE slug = 'medife'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;

-- PREMEDIC: PMO calcula % del sueldo bruto; desregulado/directo usan valor del plan.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, 'pmo', 'pct_sueldo_bruto', 7.65,
  'Plan por aportes (PMO) / afinidades. Ámbito: AMBA, Córdoba, Misiones, Tucumán, Mendoza.'
FROM public.prepagas WHERE slug = 'premedic'
UNION ALL
SELECT id, 'relacion_dependencia', 'valor_plan', 100,
  'Desregulado superador. Decomisión: 4 meses.'
FROM public.prepagas WHERE slug = 'premedic'
UNION ALL
SELECT id, 'monotributo', 'valor_plan', 100,
  'Desregulado superador (monotributo). Decomisión: 4 meses.'
FROM public.prepagas WHERE slug = 'premedic'
UNION ALL
SELECT id, 'particular', 'valor_plan', 100,
  'Directo. Comisión 100% descontando IVA. Decomisión: 4 meses.'
FROM public.prepagas WHERE slug = 'premedic'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;

-- DOCTOR RED: PMO % del sueldo bruto; superadores usan valor comisional.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, 'pmo', 'pct_sueldo_bruto', 7.038,
  'Ámbito nacional. Liquidación a 15 días del cierre. Decomisión: únicamente por falseamiento de datos en la DDJJ.'
FROM public.prepagas WHERE slug = 'doctor-red'
UNION ALL
SELECT id, 'relacion_dependencia', 'valor_plan', 100,
  'Superadores 500+/1000/2000/3000. Liquidación a 15 días del cierre. Decomisión: 6 meses.'
FROM public.prepagas WHERE slug = 'doctor-red'
UNION ALL
SELECT id, 'monotributo', 'valor_plan', 100,
  'Superadores 500+/1000/2000/3000. Liquidación a 15 días del cierre. Decomisión: 6 meses.'
FROM public.prepagas WHERE slug = 'doctor-red'
UNION ALL
SELECT id, 'particular', 'valor_plan', 100,
  'Superadores 500+/1000/2000/3000. Liquidación a 15 días del cierre. Decomisión: 6 meses.'
FROM public.prepagas WHERE slug = 'doctor-red'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;

-- PREVENCIÓN SALUD: ámbito nacional, mismo % en los 3 segmentos, decomisión 6 meses.
INSERT INTO public.prepaga_comision_reglas (prepaga_id, segmento, tipo_base, porcentaje, notas)
SELECT id, seg, 'valor_plan', 100,
  'Ámbito nacional. Liquidación mensual el día 25, por lote comisional (cierra 20-25). Decomisión: 6 meses.'
FROM public.prepagas, unnest(ARRAY['relacion_dependencia','monotributo','particular']) AS seg
WHERE slug = 'prevencion-salud'
ON CONFLICT (prepaga_id, segmento) DO NOTHING;
