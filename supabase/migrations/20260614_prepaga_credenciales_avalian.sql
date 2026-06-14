-- Tabla segura para credenciales compartidas de prepagas externas
-- RLS habilitado sin políticas = solo service_role puede leer
CREATE TABLE IF NOT EXISTS prepaga_credenciales (
  prepaga_id uuid PRIMARY KEY REFERENCES prepagas(id) ON DELETE CASCADE,
  credenciales jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prepaga_credenciales ENABLE ROW LEVEL SECURITY;
-- Sin políticas SELECT = usuarios autenticados no pueden leer directamente
-- El service_role bypasea RLS y es el único que accede vía server action

-- Actualizar AVALIAN: tipo externo + URL del portal de productores
UPDATE prepagas
SET
  tipo_cotizador = 'externo',
  cotizador_url  = 'https://online.avalian.com/ingreso?returnUrl=%2Fcotizador%2Findividuos%2Flistado'
WHERE nombre ILIKE '%avalian%';

-- Insertar credenciales compartidas de AVALIAN
INSERT INTO prepaga_credenciales (prepaga_id, credenciales)
SELECT
  id,
  '{"usuario":"carolinaferrari78@gmail.com","password":"avalian"}'::jsonb
FROM prepagas
WHERE nombre ILIKE '%avalian%'
ON CONFLICT (prepaga_id) DO UPDATE
  SET credenciales = EXCLUDED.credenciales,
      updated_at   = now();
