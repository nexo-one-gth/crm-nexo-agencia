-- =============================================================================
-- Bloque 1 — Fixes de la auditoría RLS del 2026-08-08
-- Ref: AUDITORIA_RLS_2026-08-08.md  (hallazgos C-1, H-2, H-3)
--
-- ESTADO: APLICADA el 2026-08-08 vía MCP de Supabase (proyecto `agencia`).
-- Migraciones remotas: rls_audit_bloque1 + rls_audit_bloque1_fix_execute_public.
-- Advisors de seguridad: 17 lints antes → 5 después (los 5 restantes, aceptados
-- por diseño; ver AUDITORIA_RLS_2026-08-08.md).
--
-- Alcance: solo superficie expuesta. No cambia ninguna política RLS ni ningún
-- dato. Verificado contra los 7 usos de `prepaga_asesores_safe` en src/:
-- todos son server-side y ninguno requiere cambios de código.
--
-- Idempotente: se puede correr más de una vez sin efecto adicional.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- C-1 (CRITICAL) — `prepaga_asesores_safe` saltea RLS y está expuesta a `anon`
--
-- La vista es SECURITY DEFINER (default histórico de Postgres), así que lee
-- `prepaga_asesores` con los permisos del creador e ignora sus políticas. Como
-- `anon` tiene grants y la vista es auto-actualizable, cualquiera con la
-- NEXT_PUBLIC_SUPABASE_ANON_KEY —que viaja en el bundle del browser— podía
-- leer todos los comision_pct y codigo_productor sin autenticarse.
--
-- Con security_invoker la vista pasa a respetar las políticas de la tabla base:
--   - prepaga_asesores_admin_all  → auth_is_admin() ve todo
--   - prepaga_asesores_asesor_select → cada asesor ve su propia fila
-- Que es exactamente lo que los 7 call sites ya asumen.
-- -----------------------------------------------------------------------------

alter view public.prepaga_asesores_safe set (security_invoker = on);

-- La vista es de lectura: las escrituras del código van contra la tabla base.
revoke all on public.prepaga_asesores_safe from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.prepaga_asesores_safe from authenticated;
grant select on public.prepaga_asesores_safe to authenticated;

comment on view public.prepaga_asesores_safe is
  'Vista de prepaga_asesores sin la columna credenciales. security_invoker=on: '
  'respeta el RLS de la tabla base. No otorgar privilegios a anon.';


-- -----------------------------------------------------------------------------
-- H-2 (HIGH) — search_path mutable
--
-- Sin `SET search_path`, `public.profiles` dentro del cuerpo puede resolver a
-- otra tabla según el search_path del caller. Estas tres funciones son la base
-- de TODO el modelo de permisos: si auth_is_admin() devuelve true de más, no
-- hay política que aguante.
--
-- pg_temp va último y explícito para que el schema temporal del caller no
-- pueda anteponerse a public.
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER (riesgo alto: corren como owner)
alter function public.auth_is_admin()            set search_path = public, pg_temp;
alter function public.auth_is_admin_principal()  set search_path = public, pg_temp;
alter function public.auth_is_supervisor()       set search_path = public, pg_temp;
alter function public.handle_new_user()          set search_path = public, pg_temp;

-- SECURITY INVOKER (riesgo menor, pero el linter las marca y el costo es cero)
alter function public.set_updated_at()           set search_path = public, pg_temp;
alter function public.set_lead_assigned_at()     set search_path = public, pg_temp;


-- -----------------------------------------------------------------------------
-- H-3 (HIGH) — handle_new_user() invocable por anon vía RPC
--
-- Es una trigger function sobre auth.users, pero al estar en el schema `public`
-- PostgREST la expone en /rest/v1/rpc/handle_new_user con EXECUTE para anon.
-- Siendo SECURITY DEFINER y escribiendo en profiles, no tiene por qué ser
-- llamable desde la API.
--
-- Revocar EXECUTE no afecta su ejecución como trigger: los triggers no chequean
-- privilegios de EXECUTE del usuario que dispara la operación.
-- -----------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- OJO: el EXECUTE de una función viene por el GRANT implícito a PUBLIC, así que
-- `revoke ... from anon` NO tiene efecto — hay que revocar a PUBLIC y volver a
-- otorgar explícitamente a quien lo necesita.
--
-- `authenticated` DEBE conservarlo: las políticas RLS invocan estas funciones en
-- el contexto del usuario que consulta. Verificado que ninguna política
-- `TO public` las llama, así que anon se queda sin EXECUTE sin romper nada.
revoke execute on function public.auth_is_admin()           from public;
revoke execute on function public.auth_is_admin_principal() from public;
revoke execute on function public.auth_is_supervisor()      from public;

grant execute on function public.auth_is_admin()           to authenticated, service_role;
grant execute on function public.auth_is_admin_principal() to authenticated, service_role;
grant execute on function public.auth_is_supervisor()      to authenticated, service_role;

-- Trigger functions: no las necesita nadie por RPC.
revoke execute on function public.set_updated_at()       from public;
revoke execute on function public.set_lead_assigned_at() from public;

commit;


-- =============================================================================
-- VERIFICACIÓN — correr después de aplicar
-- =============================================================================
--
-- 1) La vista quedó en security_invoker y sin grants a anon:
--
-- select c.relname,
--        c.reloptions,
--        (select string_agg(distinct grantee, ', ')
--           from information_schema.role_table_grants
--          where table_schema = 'public' and table_name = 'prepaga_asesores_safe') as grantees
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relname = 'prepaga_asesores_safe';
--
-- Esperado: reloptions = {security_invoker=on}, sin `anon` entre los grantees.
--
--
-- 2) Las 6 funciones con search_path fijo:
--
-- select p.oid::regprocedure::text as firma, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('auth_is_admin','auth_is_admin_principal','auth_is_supervisor',
--                      'handle_new_user','set_updated_at','set_lead_assigned_at');
--
-- Esperado: proconfig = {search_path=public,\ pg_temp} en las 6.
--
--
-- 3) Smoke test funcional (con un usuario asesor y uno admin):
--    - un asesor entra a /prepagas y ve solo sus prepagas asignadas
--    - un admin entra a /admin/prepagas y ve todos los asesores por prepaga
--    - /prepagas/[slug]/cotizar sigue devolviendo las credenciales del cotizador
--    - crear un usuario nuevo desde el panel admin (dispara handle_new_user)
--
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--
-- begin;
-- alter view public.prepaga_asesores_safe set (security_invoker = off);
-- grant all on public.prepaga_asesores_safe to anon, authenticated;
-- alter function public.auth_is_admin()           reset search_path;
-- alter function public.auth_is_admin_principal() reset search_path;
-- alter function public.auth_is_supervisor()      reset search_path;
-- alter function public.handle_new_user()         reset search_path;
-- alter function public.set_updated_at()          reset search_path;
-- alter function public.set_lead_assigned_at()    reset search_path;
-- grant execute on function public.handle_new_user() to anon, authenticated;
-- commit;
--
-- Nota: el rollback restaura el agujero de C-1. Existe por completitud
-- operativa, no como opción razonable.
