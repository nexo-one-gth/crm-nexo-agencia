-- ---------------------------------------------------------------------------
-- Carpeta de Google Drive por prepaga
-- Cada prepaga puede tener una carpeta de Drive con materiales (listas de
-- precios, formularios, folletos). El asesor la navega in-app desde el panel
-- de cotización vía el service account (solo lectura).
-- ---------------------------------------------------------------------------

ALTER TABLE public.prepagas
  ADD COLUMN IF NOT EXISTS drive_folder_id text;

COMMENT ON COLUMN public.prepagas.drive_folder_id IS
  'ID de la carpeta raíz de Google Drive con los materiales de la prepaga. La carpeta debe estar compartida como Lector con el service account (GOOGLE_SERVICE_ACCOUNT_EMAIL).';

-- Seed de las carpetas conocidas (el resto se cargan desde /admin/prepagas)
UPDATE public.prepagas SET drive_folder_id = '1PnnuKELGsuwbd4W9OuRqtpGidF8D7S6S' WHERE slug = 'avalian';
UPDATE public.prepagas SET drive_folder_id = '18sqOqlOOZuMRe3MFXjaLM8eOZrl2f5U6' WHERE slug = 'sancor-salud';
UPDATE public.prepagas SET drive_folder_id = '1Aps98lRRQEjTTHUiu5nHl6EfrF6GoMyA' WHERE slug = 'premedic';
