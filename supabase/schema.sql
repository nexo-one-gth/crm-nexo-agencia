-- =========================================================================================
-- COMPLETE CRM SCHEMA RECONSTRUCTION SCRIPT
-- RUN THIS IN THE SUPABASE SQL EDITOR
-- =========================================================================================

-- 1. Create custom types
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('admin', 'supervisor', 'sales_executive', 'asesor');

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'sales_executive',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Pipeline Stages Table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- 4. Lost Reasons Table
CREATE TABLE IF NOT EXISTS public.lost_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT UNIQUE NOT NULL
);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  advisor_id UUID REFERENCES public.profiles(id),
  total_leads INTEGER NOT NULL,
  daily_rhythm INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  dni TEXT,
  address_state TEXT,
  address_city TEXT,
  obra_social TEXT,
  cantidad_integrantes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  pipeline_stage_id UUID REFERENCES public.pipeline_stages(id),
  campaign_id UUID REFERENCES public.campaigns(id),
  
  -- Campos de Cotización e Info adicional (crm-lh)
  numero_tramite TEXT,
  edades TEXT,
  cuil TEXT,
  cuit_empleador TEXT,
  plan TEXT,
  valor_plan NUMERIC(12,2),
  descuento_aportes NUMERIC(12,2),
  descuento_comercial NUMERIC(12,2),
  iva NUMERIC(12,2),
  valor_final_socio NUMERIC(12,2),
  valor_forecast NUMERIC(12,2),
  observaciones_cotizacion TEXT,
  interest_level INTEGER DEFAULT 0,
  etapa_historial JSONB,
  documentacion_pendiente TEXT,
  
  -- Soft delete and Tracking
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  last_status_update_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  is_contacted BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  lost_reason_id UUID REFERENCES public.lost_reasons(id)
);

-- 7. Activities History Table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id),
    type TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Trigger to create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'first_name', 
    new.raw_user_meta_data->>'last_name', 
    new.email,
    COALESCE((new.raw_user_meta_data->>'role'), 'sales_executive')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. Insert Initial Pipeline Stages
INSERT INTO public.pipeline_stages (name, "order")
VALUES 
    ('Pendiente de Asignación', 0),
    ('Pendiente', 10),
    ('Contactado', 20),
    ('Interesado', 25),
    ('Cotizado', 30),
    ('Alta en Proceso', 40),
    ('Ganado', 50),
    ('No Interesado', 99)
ON CONFLICT (name) DO UPDATE SET "order" = EXCLUDED."order";

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 11. Basic RLS Policies (Update these according to strict RBAC needs later, or keep them simple)
CREATE POLICY "Enable all access for authenticated users" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.pipeline_stages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.lost_reasons FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.campaigns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON public.activities FOR ALL USING (auth.role() = 'authenticated');
