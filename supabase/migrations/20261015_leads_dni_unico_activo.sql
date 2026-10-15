-- Un mismo DNI (solo dígitos) no puede estar en dos leads activos.
-- Parcial: los leads con borrado lógico (deleted_at) no bloquean futuras cargas.
-- Expresión normalizada: "12.345.678" y "12345678" cuentan como el mismo DNI.
-- Ya aplicada en producción el 2026-10-15 (migración leads_dni_unico_activo).
create unique index if not exists leads_dni_unico_activo_idx
  on public.leads ((regexp_replace(dni, '\D', '', 'g')))
  where deleted_at is null
    and dni is not null
    and regexp_replace(dni, '\D', '', 'g') <> '';
