-- Revierte el borrado lógico de duplicados de DNI (Salud a tu medida + Juan Giampa)
-- ejecutado el 2026-10-15. Fueron 87 leads, todos con el mismo deleted_at.
-- Solo restaura leads (deleted_at = NULL); no se tocó altas, cotizaciones ni actividades.
update leads set deleted_at = null
where deleted_at = '2026-10-15 13:58:25.60165+00';
-- Debe afectar exactamente 87 filas.
