-- ============================================================
-- Migración: Agregar campos críticos de leads desde crm-lh
-- Fecha: 2026-02-26
-- Descripción: Agrega columnas de origen, info adicional,
--              cotización, control e historial de etapas.
-- ============================================================

-- 1. Origen
ALTER TABLE leads ADD COLUMN IF NOT EXISTS numero_tramite TEXT;

-- 2. Info Adicional (grupo familiar)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cantidad_integrantes INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS edades TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cuil TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cuit_empleador TEXT;

-- 3. Cotización (campos planos para consultas eficientes)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_plan NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS descuento_aportes NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS descuento_comercial NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_final_socio NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_forecast NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observaciones_cotizacion TEXT;

-- 4. Control y Gestión
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest_level INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS etapa_historial JSONB;

-- ============================================================
-- Comentarios sobre columnas (documentación en DB)
-- ============================================================
COMMENT ON COLUMN leads.numero_tramite IS 'ID de trámite externo del CRM anterior';
COMMENT ON COLUMN leads.cantidad_integrantes IS 'Cantidad de integrantes del grupo familiar';
COMMENT ON COLUMN leads.edades IS 'Edades de los integrantes (texto libre, ej: 30, 28, 5)';
COMMENT ON COLUMN leads.cuil IS 'CUIL del titular';
COMMENT ON COLUMN leads.cuit_empleador IS 'CUIT del empleador';
COMMENT ON COLUMN leads.plan IS 'Plan de salud cotizado';
COMMENT ON COLUMN leads.valor_plan IS 'Valor base del plan';
COMMENT ON COLUMN leads.descuento_aportes IS 'Descuento por aportes (ARS)';
COMMENT ON COLUMN leads.descuento_comercial IS 'Descuento comercial aplicado (ARS)';
COMMENT ON COLUMN leads.iva IS 'Monto de IVA';
COMMENT ON COLUMN leads.valor_final_socio IS 'Valor final que paga el socio (ARS)';
COMMENT ON COLUMN leads.valor_forecast IS 'Valor de forecast para reportes (ARS)';
COMMENT ON COLUMN leads.observaciones_cotizacion IS 'Observaciones de la cotización';
COMMENT ON COLUMN leads.interest_level IS 'Nivel de interés: 0=off, 1=medio, 2=alto';
COMMENT ON COLUMN leads.etapa_historial IS 'Historial de etapas [{etapa, fechaEntrada, fechaSalida}]';
