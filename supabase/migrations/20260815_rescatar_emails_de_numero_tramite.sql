-- Rescate de emails que quedaron guardados en leads.numero_tramite.
--
-- Contexto: numero_tramite es el ID de trámite del CRM anterior. En las
-- importaciones desde 2026-03-11 en adelante, 296 leads recibieron ahí el
-- email del contacto (y quedaron con leads.email NULL). Los 113 registros de
-- la migración inicial (2026-03-10) sí tienen números de trámite reales y no
-- se tocan.
--
-- El backup vive en el schema `backup`, que PostgREST no expone: la tabla
-- contiene emails, así que dejarla en `public` la publicaría vía API.

CREATE SCHEMA IF NOT EXISTS backup;

REVOKE ALL ON SCHEMA backup FROM anon, authenticated;

-- Snapshot de los 410 leads con numero_tramite, antes de tocar nada
CREATE TABLE IF NOT EXISTS backup.leads_numero_tramite_20260815 AS
SELECT id, numero_tramite, email, created_at, now() AS backed_up_at
FROM public.leads
WHERE numero_tramite IS NOT NULL;

REVOKE ALL ON ALL TABLES IN SCHEMA backup FROM anon, authenticated;

-- Mover el email a su columna. Condiciones deliberadamente estrictas:
--   - formato de email válido (no basta con que tenga '@')
--   - email actual NULL, para no pisar nunca un dato existente
UPDATE public.leads
SET email = numero_tramite,
    numero_tramite = NULL
WHERE numero_tramite ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND email IS NULL;

-- Rollback:
--   UPDATE public.leads l
--   SET numero_tramite = b.numero_tramite, email = b.email
--   FROM backup.leads_numero_tramite_20260815 b
--   WHERE l.id = b.id;
