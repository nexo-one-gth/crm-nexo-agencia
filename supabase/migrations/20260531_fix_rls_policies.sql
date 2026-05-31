-- =============================================================================
-- MIGRACIÓN: Corrección de RLS policies
-- Fecha: 2026-05-31
-- Problema: 6 tablas tienen "Enable all access for authenticated users"
-- que permite a cualquier asesor leer/escribir datos de otros usuarios.
-- =============================================================================

-- Helper function para evitar recursión en políticas de 'profiles'
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- =============================================================================
-- TABLA: leads (1624 filas — contiene DNI, CUIL, datos de salud)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.leads;

-- Admins: acceso total
CREATE POLICY "leads_admin_all" ON public.leads
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- Asesores: solo ven leads asignados a ellos o no asignados (pendiente de asignación)
CREATE POLICY "leads_asesor_select" ON public.leads
FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR assigned_to IS NULL);

-- Asesores: pueden crear leads (se auto-asignan en el Server Action)
CREATE POLICY "leads_asesor_insert" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (assigned_to = auth.uid() OR assigned_to IS NULL);

-- Asesores: solo pueden actualizar sus propios leads
CREATE POLICY "leads_asesor_update" ON public.leads
FOR UPDATE TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

-- =============================================================================
-- TABLA: profiles
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;

-- Todos los autenticados pueden ver todos los perfiles (necesario para vista de equipo y FK joins)
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- Cada usuario puede actualizar solo su propio perfil
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins: acceso total (INSERT para triggers, UPDATE de roles, DELETE)
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- =============================================================================
-- TABLA: activities
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.activities;

-- Admins: acceso total
CREATE POLICY "activities_admin_all" ON public.activities
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- Asesores: ven actividades de sus leads asignados
CREATE POLICY "activities_asesor_select" ON public.activities
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = activities.lead_id
    AND leads.assigned_to = auth.uid()
  )
);

-- Asesores: crean actividades en sus leads
CREATE POLICY "activities_asesor_insert" ON public.activities
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_id
    AND leads.assigned_to = auth.uid()
  )
);

-- =============================================================================
-- TABLA: campaigns
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.campaigns;

-- Admins: acceso total
CREATE POLICY "campaigns_admin_all" ON public.campaigns
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- Asesores: solo ven sus propias campañas
CREATE POLICY "campaigns_asesor_select" ON public.campaigns
FOR SELECT TO authenticated
USING (advisor_id = auth.uid());

-- =============================================================================
-- TABLA: pipeline_stages (datos de referencia — nadie debería modificarlos)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.pipeline_stages;

-- Todos los autenticados pueden leer las etapas
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
FOR SELECT TO authenticated
USING (true);

-- Solo admins pueden modificar etapas
CREATE POLICY "pipeline_stages_admin_write" ON public.pipeline_stages
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- =============================================================================
-- TABLA: lost_reasons (datos de referencia)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.lost_reasons;

CREATE POLICY "lost_reasons_select" ON public.lost_reasons
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "lost_reasons_admin_write" ON public.lost_reasons
FOR ALL TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());
