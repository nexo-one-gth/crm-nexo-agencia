-- =============================================================================
-- MIGRACIÓN: Cotizador por lead
-- Fecha: 2026-06-14
-- Cambios:
--   1. Migrar leads.edades de text a jsonb
--   2. Crear tabla lead_cotizaciones
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Migrar leads.edades → jsonb
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ALTER COLUMN edades TYPE jsonb
  USING CASE
    WHEN edades IS NULL THEN NULL
    ELSE '[]'::jsonb
  END;

COMMENT ON COLUMN public.leads.edades IS
  'Array de integrantes: [{"rol": "titular", "edad": 35}, {"rol": "hijo", "edad": 8}]';

-- ---------------------------------------------------------------------------
-- 2. Tabla lead_cotizaciones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_cotizaciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  prepaga_id          uuid NOT NULL REFERENCES public.prepagas(id),
  plan_id             uuid REFERENCES public.prepaga_planes(id),
  asesor_id           uuid NOT NULL REFERENCES public.profiles(id),
  integrantes         jsonb NOT NULL DEFAULT '[]',
  valor_calculado     numeric,
  descuento_aportes   numeric,
  descuento_comercial numeric,
  iva                 numeric,
  valor_final         numeric,
  observaciones       text,
  estado              text NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador', 'enviada', 'aprobada')),
  cotizador_tipo      text NOT NULL
                      CHECK (cotizador_tipo IN ('integrado', 'externo', 'pdf', 'manual')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lead_cotizaciones_updated_at
  BEFORE UPDATE ON public.lead_cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.lead_cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Asesores ven sus propias cotizaciones"
  ON public.lead_cotizaciones FOR SELECT
  USING (asesor_id = auth.uid());

CREATE POLICY "Admins ven todas las cotizaciones"
  ON public.lead_cotizaciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Asesores insertan sus cotizaciones"
  ON public.lead_cotizaciones FOR INSERT
  WITH CHECK (asesor_id = auth.uid());

CREATE POLICY "Asesores actualizan sus cotizaciones"
  ON public.lead_cotizaciones FOR UPDATE
  USING (asesor_id = auth.uid());
