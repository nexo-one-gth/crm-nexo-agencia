-- =============================================================================
-- Rol supervisor: función helper + políticas RLS en leads
-- -----------------------------------------------------------------------------
-- El supervisor ve y redistribuye leads de su equipo (admin_asesores) sin tener
-- acceso a la administración global (prepagas, comisiones, otros equipos).
-- El equipo se asigna igual que para admin: registros en admin_asesores donde
-- admin_id = supervisor.id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Función helper para RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Políticas RLS en leads para supervisor
-- ---------------------------------------------------------------------------
-- SELECT: su bucket (assigned_to = él) + leads de su equipo + sin asignar
CREATE POLICY "leads_supervisor_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.auth_is_supervisor()
    AND (
      assigned_to = auth.uid()
      OR assigned_to IS NULL
      OR assigned_to IN (
        SELECT asesor_id FROM public.admin_asesores WHERE admin_id = auth.uid()
      )
    )
  );

-- UPDATE: puede reasignar leads de su bucket y del pool sin asignar
CREATE POLICY "leads_supervisor_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_supervisor()
    AND (
      assigned_to = auth.uid()
      OR assigned_to IS NULL
      OR assigned_to IN (
        SELECT asesor_id FROM public.admin_asesores WHERE admin_id = auth.uid()
      )
    )
  )
  WITH CHECK (public.auth_is_supervisor());

-- ---------------------------------------------------------------------------
-- 3. Políticas RLS en admin_asesores para supervisor (leer su equipo)
-- ---------------------------------------------------------------------------
CREATE POLICY "admin_asesores_supervisor_select" ON public.admin_asesores
  FOR SELECT TO authenticated
  USING (
    public.auth_is_supervisor()
    AND admin_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. Políticas en activities: supervisor puede ver e insertar actividades
--    de leads de su equipo
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_supervisor_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.auth_is_supervisor()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = activities.lead_id
      AND (
        l.assigned_to = auth.uid()
        OR l.assigned_to IS NULL
        OR l.assigned_to IN (
          SELECT asesor_id FROM public.admin_asesores WHERE admin_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "activities_supervisor_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_supervisor()
    AND created_by = auth.uid()
  );
