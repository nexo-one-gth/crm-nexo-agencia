-- Revierte la 2da tanda de borrado lógico de duplicados de DNI (regla: se conserva la más antigua,
-- o la que tiene alta/cotización). Ejecutada el 2026-10-15. Fueron 467 leads con el mismo deleted_at.
update leads set deleted_at = null
where deleted_at = '2026-10-15 14:05:11.660074+00';
-- Debe afectar exactamente 467 filas.
