-- =============================================================================
-- C-3 (CRITICAL) — Escalada de privilegios vía `profiles_admin_all`
-- Ref: AUDITORIA_RLS_2026-08-08.md
--
-- Problema: `profiles_admin_all` es ALL/PERMISSIVE con `auth_is_admin()`, que
-- incluye al rol `admin`. Un admin puede hacer, contra PostgREST y con su
-- propio JWT:
--
--     update profiles set role = 'admin_principal' where id = <su id>;
--
-- y además editar o borrar el perfil de un admin_principal.
--
-- Verificado en `src/`: NINGUNA server action actualiza `profiles.role`. El rol
-- se define solo al crear el usuario, vía `user_metadata` → trigger
-- `handle_new_user`. Por lo tanto este fix no requiere cambios de código.
--
-- ESTADO: APLICADA el 2026-08-08 vía MCP de Supabase (proyecto `agencia`).
-- Migraciones remotas: rls_audit_c3_escalada_roles + rls_audit_c3_fix_trigger_invoker.
--
-- Suite de tests corrida simulando PostgREST (`set local role authenticated` +
-- `request.jwt.claims`), en transacción abortada:
--
--   1. admin se auto-promueve a admin_principal ... BLOQUEADO (trigger)
--   2. admin promueve a un asesor a admin ......... BLOQUEADO (trigger)
--   3. admin edita su propio nombre ............... PERMITIDO
--   4. admin borra al admin_principal ............. BLOQUEADO (policy, 0 filas)
--   5. admin_principal cambia el rol de un asesor . PERMITIDO
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Trigger — la columna `role` solo la cambia admin_principal
--
-- POR QUÉ UN TRIGGER Y NO SOLO RLS:
-- RLS filtra filas, no transiciones de columna. Una política no puede comparar
-- el valor viejo contra el nuevo (el `USING` ve OLD, el `WITH CHECK` ve NEW, y
-- no hay expresión que vea los dos). Un trigger tiene OLD y NEW nativamente.
--
-- Y lo más importante: `service_role` saltea RLS por completo, pero NO saltea
-- triggers. Un fix solo con políticas dejaría el camino de `createAdminClient()`
-- sin cubrir.
-- -----------------------------------------------------------------------------

-- SECURITY INVOKER, NO DEFINER — importante:
-- dentro de una función SECURITY DEFINER, `current_user` es el OWNER de la
-- función (postgres), no el rol de la sesión. Con DEFINER la condición de abajo
-- nunca se cumple y el trigger queda INERTE. Se detectó justamente así en el
-- test 4 (un admin promovía a un asesor a admin sin que nada lo frenara).
-- Como INVOKER, `current_user` es el rol real: `authenticated` vía PostgREST,
-- `service_role` vía createAdminClient(), `postgres` en migraciones.
--
-- No necesita ser DEFINER: solo lee NEW/OLD y llama a auth_is_admin_principal(),
-- que sí es DEFINER y sobre la que `authenticated` tiene EXECUTE.

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    -- Se bloquea solo el camino de la API con JWT de usuario (`authenticated`).
    --
    -- TRADE-OFF EXPLÍCITO: las rutas server-side con service_role y las
    -- migraciones (postgres) siguen pudiendo cambiar roles. Es necesario —si no,
    -- se rompe el alta de usuarios y cualquier migración futura— pero significa
    -- que un bug en una server action que use createAdminClient() todavía puede
    -- cambiar un rol. El guard de esas rutas sigue siendo `assertAdminPrincipal()`
    -- en la capa de aplicación. Esto cierra el ataque directo contra PostgREST,
    -- que es el que no tiene ninguna defensa hoy.
    if current_user in ('authenticated', 'anon')
       and not public.auth_is_admin_principal() then
      raise exception 'Solo admin_principal puede cambiar el rol de un usuario (rol actual: %)', current_user
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.prevent_role_escalation() is
  'C-3: impide que un admin se promueva a admin_principal vía PostgREST. '
  'Complementa las políticas RESTRICTIVE de profiles.';

drop trigger if exists profiles_prevent_role_escalation on public.profiles;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_escalation();


-- -----------------------------------------------------------------------------
-- 2. Políticas RESTRICTIVE — un admin no puede tocar a un admin_principal
--
-- Las RESTRICTIVE se combinan con AND contra todas las permissive, así que
-- recortan `profiles_admin_all` sin tener que reescribirla (eso queda para la
-- reescritura general de políticas del modelo de roles).
--
-- Efecto por caso:
--   asesor editando su propio perfil        → role='asesor'          → pasa
--   admin editando un asesor                → role='asesor'          → pasa
--   admin editando a otro admin             → role='admin'           → pasa
--   admin editando/borrando un admin_principal                       → BLOQUEADO
--   admin_principal haciendo cualquier cosa → auth_is_admin_principal() → pasa
-- -----------------------------------------------------------------------------

drop policy if exists profiles_proteger_principal_update on public.profiles;
create policy profiles_proteger_principal_update
on public.profiles
as restrictive
for update
to authenticated
using (role <> 'admin_principal' or (select public.auth_is_admin_principal()));

drop policy if exists profiles_proteger_principal_delete on public.profiles;
create policy profiles_proteger_principal_delete
on public.profiles
as restrictive
for delete
to authenticated
using (role <> 'admin_principal' or (select public.auth_is_admin_principal()));

commit;


-- =============================================================================
-- VERIFICACIÓN — simulando el ataque desde PostgREST
-- =============================================================================
--
-- El admin (rol `admin`) intenta promoverse. Debe fallar con 42501:
--
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-del-admin>","role":"authenticated"}';
--   update public.profiles set role = 'admin_principal' where id = '<uuid-del-admin>';
-- rollback;
--
-- El mismo admin editando su nombre (sin tocar role). Debe funcionar:
--
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-del-admin>","role":"authenticated"}';
--   update public.profiles set first_name = 'Test' where id = '<uuid-del-admin>';
-- rollback;
--
-- El admin intentando borrar al admin_principal. Debe afectar 0 filas:
--
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-del-admin>","role":"authenticated"}';
--   delete from public.profiles where role = 'admin_principal';
-- rollback;
--
--
-- =============================================================================
-- ROLLBACK
-- =============================================================================
--
-- begin;
-- drop trigger if exists profiles_prevent_role_escalation on public.profiles;
-- drop function if exists public.prevent_role_escalation();
-- drop policy if exists profiles_proteger_principal_update on public.profiles;
-- drop policy if exists profiles_proteger_principal_delete on public.profiles;
-- commit;
