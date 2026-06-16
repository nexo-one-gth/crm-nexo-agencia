-- =============================================================================
-- MIGRACIÓN: Rol admin_principal (super admin)
-- Fecha: 2026-06-16
-- Propósito: Distinguir entre admin regular y admin principal.
--   - admin_principal: gestiona a otros admins, ve sus propios asesores
--   - admin: solo gestiona su equipo de asesores
-- =============================================================================

-- Actualizar auth_is_admin para incluir admin_principal
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'admin_principal')
  )
$$;

-- Helper exclusivo para admin_principal
CREATE OR REPLACE FUNCTION public.auth_is_admin_principal()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin_principal'
  )
$$;

-- Crear tabla admin_asesores si no existe (puede que ya exista en prod)
CREATE TABLE IF NOT EXISTS public.admin_asesores (
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  asesor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (admin_id, asesor_id)
);

ALTER TABLE public.admin_asesores ENABLE ROW LEVEL SECURITY;

-- Política: admins y admin_principal pueden leer y escribir
DROP POLICY IF EXISTS "admin_asesores_all" ON public.admin_asesores;
CREATE POLICY "admin_asesores_all" ON public.admin_asesores
  FOR ALL TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Política: cada admin puede leer sus propias asignaciones
DROP POLICY IF EXISTS "admin_asesores_own_select" ON public.admin_asesores;
CREATE POLICY "admin_asesores_own_select" ON public.admin_asesores
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid());
