-- =============================================================================
-- Modelo de roles — FASE A: schema aditivo
-- Ref: MODELO_ROLES.md secciones 2.1, 2.2, 2.4
--
-- ADITIVA Y SIN CAMBIO DE COMPORTAMIENTO. No toca ninguna política existente,
-- no cambia ninguna query del código, no altera lo que ve ningún usuario.
-- El único objetivo es que el schema pueda representar el modelo nuevo.
--
-- Volumen al momento de aplicar: 1 comisión, 6 altas, 1 cierre. El backfill es
-- trivial y el riesgo, mínimo.
--
-- NO incluye el rename admin_asesores → supervisor_asesores: eso rompe queries
-- del código y va en Fase B, junto con la reescritura de políticas.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. comisiones — de 1:1 a N:1 con el alta
--
-- Con override, una venta genera más de una comisión: la directa del asesor y
-- la del líder. Se agregan las columnas, se backfillea lo existente como
-- 'directa', y recién después se afloja la unique.
--
-- `asesor_id` se conserva por ahora: el código todavía lo usa. Se dropea en
-- Fase B/C, una vez migradas las queries.
-- -----------------------------------------------------------------------------

alter table public.comisiones
  add column if not exists beneficiario_id uuid references public.profiles(id),
  add column if not exists vendedor_id     uuid references public.profiles(id),
  add column if not exists supervisor_id   uuid references public.profiles(id),
  add column if not exists tipo            text;

-- Backfill: todo lo existente es comisión directa del asesor.
update public.comisiones
   set beneficiario_id = coalesce(beneficiario_id, asesor_id),
       vendedor_id     = coalesce(vendedor_id, asesor_id),
       tipo            = coalesce(tipo, 'directa')
 where beneficiario_id is null or vendedor_id is null or tipo is null;

-- Snapshot del líder para lo ya existente, best-effort desde la relación actual.
-- Es lo único que no se puede reconstruir con exactitud hacia atrás; de acá en
-- adelante lo escribe el generador en el momento de la venta.
update public.comisiones c
   set supervisor_id = aa.admin_id
  from public.admin_asesores aa
 where aa.asesor_id = c.vendedor_id
   and c.supervisor_id is null;

alter table public.comisiones
  alter column beneficiario_id set not null,
  alter column vendedor_id     set not null,
  alter column tipo            set not null;

-- `tipo` queda como text con CHECK, no como enum: agregar un nivel más de
-- override (admin sobre sus líderes) tiene que ser un ALTER del check y no una
-- migración de tipo.
alter table public.comisiones
  drop constraint if exists comisiones_tipo_check;
alter table public.comisiones
  add constraint comisiones_tipo_check check (tipo in ('directa', 'override'));

-- La unique vieja impedía la segunda fila por venta.
alter table public.comisiones drop constraint if exists comisiones_alta_id_key;
alter table public.comisiones
  add constraint comisiones_alta_beneficiario_tipo_key
  unique (alta_id, beneficiario_id, tipo);

-- Índices sobre las columnas del predicado de RLS: sin esto, cada consulta del
-- dashboard filtrada por política es un seq scan.
create index if not exists comisiones_beneficiario_idx on public.comisiones (beneficiario_id);
create index if not exists comisiones_supervisor_idx   on public.comisiones (supervisor_id);
create index if not exists comisiones_vendedor_idx     on public.comisiones (vendedor_id);

comment on column public.comisiones.beneficiario_id is
  'Quién cobra esta fila. Es la columna sobre la que filtra el RLS.';
comment on column public.comisiones.vendedor_id is
  'Quién hizo la venta. En tipo=directa coincide con beneficiario_id.';
comment on column public.comisiones.supervisor_id is
  'Snapshot del líder al momento de generar. NO recalcular: si un asesor cambia '
  'de equipo, recalcularlo reescribe el pasado de dos líderes a la vez.';


-- -----------------------------------------------------------------------------
-- 2. supervisor_overrides — porcentajes de override por líder y prepaga
--
-- Grano distinto al de prepaga_comision_reglas (que es de la agencia), por eso
-- va en tabla propia. Misma forma que prepaga_asesores.comision_pct.
--
-- pct_venta_propia nullable: cargar el porcentaje ES activarlo. Un booleano
-- aparte permitiría estados contradictorios (activo sin porcentaje, o al revés).
-- -----------------------------------------------------------------------------

create table if not exists public.supervisor_overrides (
  id                uuid primary key default gen_random_uuid(),
  supervisor_id     uuid not null references public.profiles(id) on delete cascade,
  prepaga_id        uuid not null references public.prepagas(id) on delete cascade,
  pct_equipo        numeric,
  pct_venta_propia  numeric,
  vigente_desde     date not null default current_date,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        uuid references public.profiles(id),
  unique (supervisor_id, prepaga_id, vigente_desde),
  constraint supervisor_overrides_pct_equipo_check
    check (pct_equipo is null or pct_equipo > 0),
  constraint supervisor_overrides_pct_propia_check
    check (pct_venta_propia is null or pct_venta_propia > 0),
  constraint supervisor_overrides_algo_cargado_check
    check (pct_equipo is not null or pct_venta_propia is not null)
);

create index if not exists supervisor_overrides_supervisor_idx
  on public.supervisor_overrides (supervisor_id, prepaga_id, vigente_desde desc);

comment on table public.supervisor_overrides is
  'Overrides por líder y prepaga. NO se consulta por profiles.role: quien tiene '
  'fila acá cobra override, sea supervisor, admin o admin_principal (caso de un '
  'admin que además conduce un equipo).';
comment on column public.supervisor_overrides.pct_venta_propia is
  'Override sobre las ventas propias del líder. NULL = no cobra. Cargar el '
  'porcentaje es lo que lo activa.';

alter table public.supervisor_overrides enable row level security;

-- Escritura: solo admin_principal (define la política comercial de la agencia).
create policy supervisor_overrides_principal_all
on public.supervisor_overrides
for all to authenticated
using ((select public.auth_is_admin_principal()))
with check ((select public.auth_is_admin_principal()));

-- Lectura: admins ven todo; cada líder ve el suyo.
create policy supervisor_overrides_select
on public.supervisor_overrides
for select to authenticated
using ((select public.auth_is_admin()) or supervisor_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 3. profiles.solo_lectura — anticipar al colaborador externo
--
-- Hace ortogonales la visibilidad y la escritura: al contable se le da el nivel
-- que corresponda y este flag en true. La condición se suma a las políticas de
-- escritura en Fase B, que de todos modos se reescriben.
--
-- Agregarlo ahora cuesta una columna; retrofitearlo obliga a revisar todas las
-- políticas de escritura otra vez.
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists solo_lectura boolean not null default false;

comment on column public.profiles.solo_lectura is
  'true = el usuario ve lo que su rol permite pero no puede escribir. Para '
  'perfiles externos al organigrama (administración, contador).';

commit;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
--
-- select tipo, count(*), count(supervisor_id) as con_supervisor
--   from public.comisiones group by tipo;
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conrelid = 'public.comisiones'::regclass
--    and contype in ('u','c');
--
-- Esperado: todas las filas en tipo='directa', y la unique nueva
-- (alta_id, beneficiario_id, tipo) en lugar de la vieja (alta_id).
--
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--
-- begin;
-- alter table public.comisiones drop constraint if exists comisiones_alta_beneficiario_tipo_key;
-- alter table public.comisiones add constraint comisiones_alta_id_key unique (alta_id);
-- alter table public.comisiones drop constraint if exists comisiones_tipo_check;
-- alter table public.comisiones
--   drop column if exists beneficiario_id,
--   drop column if exists vendedor_id,
--   drop column if exists supervisor_id,
--   drop column if exists tipo;
-- drop table if exists public.supervisor_overrides;
-- alter table public.profiles drop column if exists solo_lectura;
-- commit;
--
-- Nota: la unique vieja solo se puede restaurar si no se generó todavía ninguna
-- fila de override. Después de Fase C, este rollback deja de ser viable.
