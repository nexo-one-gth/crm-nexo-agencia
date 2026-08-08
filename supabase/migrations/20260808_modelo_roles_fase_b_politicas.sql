-- =============================================================================
-- Modelo de roles — FASE B: helpers + reescritura de políticas
-- Ref: MODELO_ROLES.md sección 3 · AUDITORIA_RLS_2026-08-08.md (C-2, H-4, H-5, L-4, M-1, M-4, M-5)
--
-- CERO CAMBIOS DE CÓDIGO. Solo políticas y funciones. El rename de
-- `admin_asesores` → `supervisor_asesores` queda deliberadamente afuera: son 12
-- sitios en el código, no aporta seguridad, y mezclarlo acá haría que un fallo
-- pueda venir de dos lugares distintos. Va en un cambio aislado después.
--
-- Recordatorio de lectura: en `admin_asesores`, la columna `admin_id` contiene
-- al LÍDER del equipo (hoy Carolina, cuyo role es 'admin'). El nombre miente.
--
-- ESTADO: APLICADA el 2026-08-08 vía MCP (modelo_roles_fase_b_politicas +
-- fase_b_fix_revoke_anon_helpers).
--
-- Suite de tests corrida simulando PostgREST, en transacciones abortadas.
-- Universo real: 4924 leads, 293 sin asignar, 6 altas, 17 asesores.
--
--   LEADS      asesor 145 (0 del pool) · líder 464 (incluye los 293 del pool)
--              admin 4924 · admin_principal 4924
--   COMISIONES asesor 1 (su directa) · líder 2 (su override + la de su asesor)
--              asesor de afuera 1 · admin 4 (todas)
--   ALTAS      dueño 5 · su líder 5 · asesor de afuera 0
--   CIERRES    asesor 1 · líder 1  (antes: todos veían todos)
--
--   H-5  asesor se auto-sirve del pool ......... BLOQUEADO
--   H-4  líder reasigna un lead fuera del equipo BLOQUEADO
--   ---  asesor edita el monto de su comisión .. BLOQUEADO
--   ---  líder aprueba un alta de su equipo .... BLOQUEADO (decisión pendiente)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Helpers de alcance
--
-- `auth_asesores_visibles()` devuelve un SET y no toma argumentos: eso es
-- deliberado. Al no depender de la fila, Postgres la evalúa UNA VEZ por query
-- como InitPlan, en vez de una vez por fila. Una función `puede_ver(target)`
-- llamada desde el USING se ejecutaría por cada fila escaneada — en `leads` y
-- `comisiones`, que son las que alimentan el dashboard, la diferencia es real.
--
-- Y sigue habiendo un único lugar donde está escrito "quién es mi gente", que
-- es lo que importa el día que cambie la decisión sobre el alcance del admin.
-- -----------------------------------------------------------------------------

create or replace function public.auth_asesores_visibles()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- uno mismo
  select auth.uid()
  union
  -- su equipo, POR RELACIÓN y no por rol: quien figura como líder puede tener
  -- role 'supervisor', 'admin' o 'admin_principal' (el caso Carolina).
  select asesor_id from public.admin_asesores where admin_id = auth.uid()
$$;

comment on function public.auth_asesores_visibles() is
  'Set de asesores que el usuario actual puede ver: él mismo + su equipo. '
  'NO incluye el caso admin (que ve todo): eso se resuelve con auth_is_admin() '
  'en la política, para no materializar la lista completa de asesores.';


-- ¿Puede repartir leads del pool? Admin, o cualquiera que tenga equipo a cargo.
create or replace function public.auth_puede_asignar()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_is_admin()
      or exists (select 1 from public.admin_asesores where admin_id = auth.uid())
$$;


-- Colaborador externo (contable, administración): ve lo que su rol permite,
-- pero no escribe. Ver profiles.solo_lectura (Fase A).
create or replace function public.auth_puede_escribir()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not coalesce(
    (select solo_lectura from public.profiles where id = auth.uid()), false)
$$;


-- Wrapper por comodidad para código server-side. Las políticas NO lo usan:
-- usan el set de arriba, por la razón de performance explicada.
create or replace function public.auth_puede_ver_asesor(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_is_admin()
      or target in (select public.auth_asesores_visibles())
$$;


-- Hay DOS fuentes de EXECUTE sobre una función nueva en `public`:
--   1. el GRANT implícito a PUBLIC de Postgres, y
--   2. un GRANT EXPLÍCITO a anon/authenticated/service_role que Supabase aplica
--      por ALTER DEFAULT PRIVILEGES a toda función creada en este schema.
-- Revocar a uno solo deja el otro en pie. Hay que revocar a AMBOS.
-- Verificar siempre con has_function_privilege('anon', oid, 'EXECUTE').
revoke execute on function public.auth_asesores_visibles()        from anon, public;
revoke execute on function public.auth_puede_asignar()            from anon, public;
revoke execute on function public.auth_puede_escribir()           from anon, public;
revoke execute on function public.auth_puede_ver_asesor(uuid)     from anon, public;

grant execute on function public.auth_asesores_visibles()     to authenticated, service_role;
grant execute on function public.auth_puede_asignar()         to authenticated, service_role;
grant execute on function public.auth_puede_escribir()        to authenticated, service_role;
grant execute on function public.auth_puede_ver_asesor(uuid)  to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. leads — cierra C-2, H-4 y H-5
--
-- H-5: el pool (assigned_to IS NULL) deja de ser visible para los asesores.
--      Con asignación manual, el pool es lo que el admin todavía no repartió.
-- H-4: el WITH CHECK del UPDATE ahora REPITE la condición del USING. Antes
--      solo validaba `auth_is_supervisor()`, con lo cual un líder podía tomar
--      un lead de su equipo y reasignarlo afuera, o dejarlo en NULL.
-- C-2: la jerarquía queda en un solo lugar (el set de helpers).
-- -----------------------------------------------------------------------------

drop policy if exists leads_admin_all         on public.leads;
drop policy if exists leads_asesor_select     on public.leads;
drop policy if exists leads_supervisor_select on public.leads;
drop policy if exists leads_asesor_update     on public.leads;
drop policy if exists leads_supervisor_update on public.leads;
drop policy if exists leads_asesor_insert     on public.leads;

create policy leads_select on public.leads
for select to authenticated
using (
  (select public.auth_is_admin())
  or assigned_to in (select public.auth_asesores_visibles())
  or (assigned_to is null and (select public.auth_puede_asignar()))
);

create policy leads_insert on public.leads
for insert to authenticated
with check (
  (select public.auth_puede_escribir())
  and (
    (select public.auth_is_admin())
    or assigned_to in (select public.auth_asesores_visibles())
    or (assigned_to is null and (select public.auth_puede_asignar()))
  )
);

create policy leads_update on public.leads
for update to authenticated
using (
  (select public.auth_is_admin())
  or assigned_to in (select public.auth_asesores_visibles())
  or (assigned_to is null and (select public.auth_puede_asignar()))
)
with check (
  (select public.auth_puede_escribir())
  and (
    (select public.auth_is_admin())
    or assigned_to in (select public.auth_asesores_visibles())
    or (assigned_to is null and (select public.auth_puede_asignar()))
  )
);

create policy leads_delete on public.leads
for delete to authenticated
using ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 3. altas — cierra L-4 (el líder no veía las ventas de su equipo)
--
-- DECISIÓN PENDIENTE marcada en MODELO_ROLES.md §5: el líder puede VER las
-- altas de su equipo pero no editarlas, porque editar `estado` es aprobar la
-- venta y todavía no está definido si eso le corresponde. Habilitarlo después
-- es cambiar una línea del USING de altas_update.
-- -----------------------------------------------------------------------------

drop policy if exists altas_admin_all     on public.altas;
drop policy if exists altas_asesor_select on public.altas;
drop policy if exists altas_asesor_insert on public.altas;
drop policy if exists altas_asesor_update on public.altas;

create policy altas_select on public.altas
for select to authenticated
using (
  (select public.auth_is_admin())
  or asesor_id in (select public.auth_asesores_visibles())
);

create policy altas_insert on public.altas
for insert to authenticated
with check (
  (select public.auth_puede_escribir())
  and (asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
);

create policy altas_update on public.altas
for update to authenticated
using (asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
with check (
  (select public.auth_puede_escribir())
  and (asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
);

create policy altas_delete on public.altas
for delete to authenticated
using ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 4. alta_items y alta_integrantes — siguen a su alta
-- -----------------------------------------------------------------------------

drop policy if exists alta_items_admin_all  on public.alta_items;
drop policy if exists alta_items_asesor_all on public.alta_items;

create policy alta_items_select on public.alta_items
for select to authenticated
using (exists (
  select 1 from public.altas a
   where a.id = alta_items.alta_id
     and ((select public.auth_is_admin()) or a.asesor_id in (select public.auth_asesores_visibles()))
));

create policy alta_items_write on public.alta_items
for all to authenticated
using (exists (
  select 1 from public.altas a
   where a.id = alta_items.alta_id
     and (a.asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
))
with check ((select public.auth_puede_escribir()) and exists (
  select 1 from public.altas a
   where a.id = alta_items.alta_id
     and (a.asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
));


drop policy if exists alta_integrantes_admin_all  on public.alta_integrantes;
drop policy if exists alta_integrantes_asesor_all on public.alta_integrantes;

create policy alta_integrantes_select on public.alta_integrantes
for select to authenticated
using (exists (
  select 1 from public.altas a
   where a.id = alta_integrantes.alta_id
     and ((select public.auth_is_admin()) or a.asesor_id in (select public.auth_asesores_visibles()))
));

create policy alta_integrantes_write on public.alta_integrantes
for all to authenticated
using (exists (
  select 1 from public.altas a
   where a.id = alta_integrantes.alta_id
     and (a.asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
))
with check ((select public.auth_puede_escribir()) and exists (
  select 1 from public.altas a
   where a.id = alta_integrantes.alta_id
     and (a.asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
));


-- -----------------------------------------------------------------------------
-- 5. comisiones — filtra por beneficiario, y el equipo por SNAPSHOT
--
-- El líder ve las comisiones de su equipo por `supervisor_id` (congelado al
-- generar la comisión), NO por la membresía actual de admin_asesores. Si un
-- asesor cambia de equipo, el histórico no se le reescribe a nadie.
--
-- Y con `beneficiario_id` una sola línea cubre los dos tipos de fila del líder:
-- las directas de sus propias ventas y sus overrides.
-- -----------------------------------------------------------------------------

drop policy if exists "Asesor ve sus propias comisiones, admin ve todas" on public.comisiones;
drop policy if exists "Solo admin crea y modifica comisiones"            on public.comisiones;

create policy comisiones_select on public.comisiones
for select to authenticated
using (
  (select public.auth_is_admin())
  or beneficiario_id = (select auth.uid())
  or supervisor_id   = (select auth.uid())
);

create policy comisiones_admin_write on public.comisiones
for all to authenticated
using ((select public.auth_is_admin()))
with check ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 6. cierres_comisionales — cierra M-1
--
-- Antes: SELECT USING (true) — todo asesor veía los lotes de liquidación de
-- todas las prepagas de la agencia. Ahora ve solo los lotes donde tiene alguna
-- comisión propia o de su equipo.
-- -----------------------------------------------------------------------------

drop policy if exists "Cierres visibles para todos los autenticados" on public.cierres_comisionales;
drop policy if exists "Solo admin gestiona cierres comisionales"     on public.cierres_comisionales;

create policy cierres_select on public.cierres_comisionales
for select to authenticated
using (
  (select public.auth_is_admin())
  or exists (
    select 1 from public.comisiones c
     where c.cierre_id = cierres_comisionales.id
       and (c.beneficiario_id = (select auth.uid()) or c.supervisor_id = (select auth.uid()))
  )
);

create policy cierres_admin_write on public.cierres_comisionales
for all to authenticated
using ((select public.auth_is_admin()))
with check ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 7. activities — el historial sigue la visibilidad del lead
-- -----------------------------------------------------------------------------

drop policy if exists activities_admin_all          on public.activities;
drop policy if exists activities_asesor_select      on public.activities;
drop policy if exists activities_supervisor_select  on public.activities;
drop policy if exists activities_asesor_insert      on public.activities;
drop policy if exists activities_supervisor_insert  on public.activities;

create policy activities_select on public.activities
for select to authenticated
using (exists (
  select 1 from public.leads l
   where l.id = activities.lead_id
     and ((select public.auth_is_admin())
          or l.assigned_to in (select public.auth_asesores_visibles())
          or (l.assigned_to is null and (select public.auth_puede_asignar())))
));

create policy activities_insert on public.activities
for insert to authenticated
with check (
  (select public.auth_puede_escribir())
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.leads l
     where l.id = activities.lead_id
       and ((select public.auth_is_admin())
            or l.assigned_to in (select public.auth_asesores_visibles())
            or (l.assigned_to is null and (select public.auth_puede_asignar())))
  )
);

create policy activities_admin_write on public.activities
for all to authenticated
using ((select public.auth_is_admin()))
with check ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 8. lead_cotizaciones — cierra M-5 (estaban TO public, o sea incluían a anon)
--    y M-4 (chequeaban role='admin' literal, dejando afuera a admin_principal)
-- -----------------------------------------------------------------------------

drop policy if exists "Asesores insertan sus cotizaciones"   on public.lead_cotizaciones;
drop policy if exists "Admins ven todas las cotizaciones"    on public.lead_cotizaciones;
drop policy if exists "Asesores ven sus propias cotizaciones" on public.lead_cotizaciones;
drop policy if exists "Asesores actualizan sus cotizaciones"  on public.lead_cotizaciones;

create policy lead_cotizaciones_select on public.lead_cotizaciones
for select to authenticated
using (
  (select public.auth_is_admin())
  or asesor_id in (select public.auth_asesores_visibles())
);

create policy lead_cotizaciones_write on public.lead_cotizaciones
for all to authenticated
using (asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
with check (
  (select public.auth_puede_escribir())
  and (asesor_id = (select auth.uid()) or (select public.auth_is_admin()))
);


-- -----------------------------------------------------------------------------
-- 9. admin_asesores — limpieza (L-2 y M-4)
--
-- Se borra la política legacy `TO public` que chequeaba role='admin' literal:
-- dejaba afuera a admin_principal y estaba duplicada con admin_asesores_all.
-- -----------------------------------------------------------------------------

drop policy if exists "Admins can manage admin_asesores"     on public.admin_asesores;
drop policy if exists admin_asesores_own_select              on public.admin_asesores;
drop policy if exists admin_asesores_supervisor_select       on public.admin_asesores;
drop policy if exists admin_asesores_all                     on public.admin_asesores;

create policy admin_asesores_select on public.admin_asesores
for select to authenticated
using (
  (select public.auth_is_admin())
  or admin_id  = (select auth.uid())
  or asesor_id = (select auth.uid())
);

create policy admin_asesores_admin_write on public.admin_asesores
for all to authenticated
using ((select public.auth_is_admin()))
with check ((select public.auth_is_admin()) and (select public.auth_puede_escribir()));


-- -----------------------------------------------------------------------------
-- 10. Índices de apoyo al RLS
-- -----------------------------------------------------------------------------

create index if not exists admin_asesores_admin_idx on public.admin_asesores (admin_id);
create index if not exists leads_assigned_to_idx    on public.leads (assigned_to);
create index if not exists altas_asesor_idx         on public.altas (asesor_id);

commit;
