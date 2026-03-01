-- ============================================================
-- Migración: Agregar documentación pendiente y sincronizar etapas
-- Fecha: 2026-03-01
-- ============================================================

-- 1. Agregar columna de documentación pendiente si no existe
ALTER TABLE leads ADD COLUMN IF NOT EXISTS documentacion_pendiente TEXT;
COMMENT ON COLUMN leads.documentacion_pendiente IS 'Detalle de documentación que falta entregar por el socio';

-- 2. Asegurar que todas las etapas del mini-pipeline existan en pipeline_stages
-- El orden actual sugerido es: 
-- Pendiente (0), Contactado (1), Interesado (2), Cotizado (3), Alta en Proceso (4), Ganado (5)

INSERT INTO pipeline_stages (name, "order")
VALUES 
    ('Cotizado', 30),
    ('Alta en Proceso', 40),
    ('Ganado', 50)
ON CONFLICT (name) DO UPDATE 
SET "order" = EXCLUDED."order";

-- Ajustar órdenes de las etapas base si es necesario para mantener la secuencia
UPDATE pipeline_stages SET "order" = 0 WHERE name = 'Pendiente de Asignación';
UPDATE pipeline_stages SET "order" = 10 WHERE name = 'Pendiente';
UPDATE pipeline_stages SET "order" = 20 WHERE name = 'Contactado';
UPDATE pipeline_stages SET "order" = 25 WHERE name = 'Interesado';
UPDATE pipeline_stages SET "order" = 99 WHERE name = 'No Interesado';
