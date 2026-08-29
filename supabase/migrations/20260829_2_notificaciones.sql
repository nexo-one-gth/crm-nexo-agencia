-- Avisos al usuario cuando le cae trabajo nuevo. Arranca con la asignación de
-- leads, pero la tabla es genérica a propósito (`tipo` + `link`) para que
-- alta aprobada, comisión liquidada o cierre de lote no necesiten otra tabla.
--
-- Por qué tabla propia y no derivarlo de `activities`: `activities` es el
-- historial DE UN LEAD y su RLS se resuelve por visibilidad del lead — un
-- supervisor ve las actividades de todo su equipo. Una notificación tiene un
-- destinatario único y un estado leída/no leída que es de esa persona, no del
-- lead. Mezclarlas obligaría a que la campanita filtre a mano quién es el
-- destinatario, que es exactamente el patrón de bug anotado en CLAUDE.md.

create table public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profiles(id) on delete cascade,
  tipo            text not null check (tipo in ('lead_asignado', 'leads_para_repartir')),
  titulo          text not null,
  cuerpo          text,
  link            text,
  -- Solo se completa cuando el aviso habla de un lead puntual. En el aviso por
  -- lote queda NULL: el lote no tiene un lead "el" al que apuntar.
  lead_id         uuid references public.leads(id) on delete cascade,
  cantidad        integer not null default 1 check (cantidad > 0),
  -- Quién generó el aviso (el admin/supervisor que asignó). Nullable porque el
  -- aviso sobrevive a la baja del perfil que lo originó.
  origen_id       uuid references public.profiles(id) on delete set null,
  leida_at        timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.notificaciones is
  'Bandeja de avisos por usuario. Se inserta SOLO desde el servidor con service_role: no hay policy de INSERT, así que un cliente con anon key no puede fabricar avisos para otro.';
comment on column public.notificaciones.tipo is
  'lead_asignado = te asignaron leads para trabajar. leads_para_repartir = te llegó un lote a tu buzón de /equipo para que lo repartas.';

-- La campanita siempre pide "las últimas N mías".
create index notificaciones_destinatario_fecha_idx
  on public.notificaciones (destinatario_id, created_at desc);

-- El badge de no leídas es la query más frecuente; parcial para que el índice
-- no crezca con el histórico ya leído.
create index notificaciones_no_leidas_idx
  on public.notificaciones (destinatario_id)
  where leida_at is null;

alter table public.notificaciones enable row level security;
alter table public.notificaciones force row level security;

-- Cada uno ve solo lo suyo. Sin excepción para admin/admin_principal: la
-- bandeja de otro no es un dato de gestión, y un admin que quiera auditar
-- asignaciones tiene `activities` y `leads.assigned_at`.
create policy "notificaciones_select_propias"
  on public.notificaciones for select
  to authenticated
  using (destinatario_id = (select auth.uid()));

-- Marcar leída. El grant de columnas de abajo es lo que impide que el
-- destinatario reescriba el titulo o el link de su propio aviso: la policy
-- sola no alcanza para eso.
create policy "notificaciones_update_propias"
  on public.notificaciones for update
  to authenticated
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));

-- Sin policies de INSERT ni DELETE: nadie inserta ni borra con anon key.
-- El insert lo hace el servidor con service_role, que salta RLS.

revoke all on public.notificaciones from authenticated;
grant select on public.notificaciones to authenticated;
grant update (leida_at) on public.notificaciones to authenticated;

-- Realtime: la campanita se entera del aviso sin recargar. Realtime aplica la
-- policy de SELECT por suscriptor, así que un asesor solo recibe sus filas
-- aunque la suscripción esté mal filtrada del lado del cliente.
alter publication supabase_realtime add table public.notificaciones;
