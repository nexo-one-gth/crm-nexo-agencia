-- Separa "lead que estoy trabajando" de "lead que me asignaron solo para
-- repartirlo a mi equipo". Sin esta columna, assigned_to = mi_id es ambiguo
-- para cualquiera que sea supervisor y asesor a la vez (caso Carolina): la
-- pantalla /equipo no puede distinguir la cartera propia del lote a
-- repartir, y "Repartir equitativo" termina moviendo ventas reales de la
-- bandeja de asesor del supervisor hacia el resto del equipo.
alter table public.leads
  add column pendiente_reparto boolean not null default false;

comment on column public.leads.pendiente_reparto is
  'true = este lead está en la bandeja del supervisor solo para que lo reparta a su equipo, no es su cartera propia. Se limpia a false en cuanto se asigna a un asesor puntual (incluido el propio supervisor, si se lo queda para trabajar).';
