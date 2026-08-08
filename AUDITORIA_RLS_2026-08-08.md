# Auditoría RLS — CRM Nexo Agencia

**Fecha:** 2026-08-08
**Proyecto Supabase:** `agencia` (`pwjpwluvubkhmxtdgkhe`) — Postgres 17.6
**Herramienta:** skill `rls-audit` + Supabase database linter (advisors)
**Alcance:** schema `public`. Solo lectura — no se modificó nada.

---

## Resumen

| Métrica | Valor |
|---|---|
| Tablas en `public` | 27 |
| Con RLS habilitado | 27 (100%) |
| Con `FORCE ROW LEVEL SECURITY` | **0** |
| Con RLS pero **sin políticas** | 1 (`prepaga_credenciales`) |
| Vistas `SECURITY DEFINER` | 1 (`prepaga_asesores_safe`) |
| Funciones con `search_path` mutable | 6 (4 de ellas `SECURITY DEFINER`) |
| Políticas con `USING (true)` | 10 |

**Hallazgos:** 3 CRITICAL · 5 HIGH · 6 MEDIUM · 4 LOW

> **Actualización 2026-08-08 — Bloque 1 aplicado.** C-1, H-2 y H-3 están resueltos
> en la base (`supabase/migrations/20260808_rls_audit_bloque1.sql`). Los advisors
> de seguridad de Supabase pasaron de 17 lints a 5.
>
> Los 5 restantes son **aceptados por diseño**, no trabajo pendiente:
> - 3× "authenticated puede ejecutar `auth_is_admin` / `auth_is_admin_principal` /
>   `auth_is_supervisor`" — es obligatorio: las políticas RLS las invocan en el
>   contexto del usuario. No filtran nada (cada una responde sobre quien llama).
> - 1× `prepaga_credenciales` con RLS y sin políticas — es el deny-all buscado (L-1).
> - 1× protección de contraseñas filtradas desactivada (L-5) — es un toggle del
>   dashboard de Auth, no SQL.
>
> **C-3 también aplicado** (`20260808_rls_audit_c3_escalada_roles.sql`): trigger
> `prevent_role_escalation` + dos políticas `RESTRICTIVE` sobre `profiles`.
> Verificado con 5 tests simulando PostgREST. No lo detectan los advisors —
> es lógica de negocio, no un lint.
>
> **Fase B aplicada** (`20260808_modelo_roles_fase_b_politicas.sql`): cierra
> **C-2, H-4, H-5, L-2, L-4, M-1, M-4 y M-5**. 23 políticas reescritas sobre
> `leads`, `altas`, `alta_items`, `alta_integrantes`, `comisiones`,
> `cierres_comisionales`, `activities`, `lead_cotizaciones` y `admin_asesores`,
> más los helpers `auth_asesores_visibles()`, `auth_puede_asignar()` y
> `auth_puede_escribir()`. Validada con suite de tests por rol.
>
> Pendiente: H-1 (`workflows` / `instancias_whatsapp`), M-2 (`profiles_select`),
> M-3 (`configuracion_global`), M-6 (`FORCE RLS`) y los LOW.

El piso está bien: RLS está prendido en todas las tablas y el patrón `auth_is_admin()` / `auth_is_supervisor()` es correcto. Los problemas son de **alcance** (quién ve qué) y de **superficie expuesta al rol `anon`**, no de ausencia de RLS.

---

## CRITICAL

### C-1. `prepaga_asesores_safe` es una vista SECURITY DEFINER con grants a `anon`

```
View public.prepaga_asesores_safe → SECURITY DEFINER
grants: anon = SELECT, INSERT, UPDATE, DELETE
```

La vista lee `prepaga_asesores` con los permisos del creador (`postgres`), por lo que **saltea el RLS de la tabla base**. Como `anon` tiene grants y la vista es auto-actualizable (SELECT simple sobre una sola tabla), cualquiera con la `NEXT_PUBLIC_SUPABASE_ANON_KEY` — que viaja en el bundle del browser — puede pegarle a `/rest/v1/prepaga_asesores_safe` y leer **todos** los `comision_pct` y `codigo_productor` de todos los asesores, sin estar logueado. Potencialmente también escribir.

Esto rompe justamente lo que la vista pretendía proteger.

**Fix:** `ALTER VIEW public.prepaga_asesores_safe SET (security_invoker = on);` + `REVOKE ALL ON public.prepaga_asesores_safe FROM anon;`

---

### C-2. El rol `admin` no está acotado a su equipo — ve todo

`auth_is_admin()` devuelve `true` para `admin` **y** `admin_principal`. Todas las políticas críticas usan esa función sin filtro de equipo:

| Tabla | Política | Efecto |
|---|---|---|
| `leads` | `leads_admin_all` (ALL) | admin de equipo ve/edita leads de otros equipos |
| `comisiones` | `Solo admin crea y modifica` + SELECT `asesor_id = auth.uid() OR auth_is_admin()` | admin de equipo ve comisiones de todos los asesores de la agencia |
| `altas` | `altas_admin_all` | ídem altas |
| `profiles` | `profiles_admin_all` | admin de equipo puede cambiar el `role` de cualquiera, incluido a sí mismo → **escalada a `admin_principal`** |

El modelo documentado dice "admin de equipo ve las ventas de su equipo". El RLS no lo implementa. El único rol con scope de equipo real es `supervisor` (vía `admin_asesores`), y solo en `leads`, `activities` y `admin_asesores`.

**Decisión tuya:** ¿`admin` = admin general y `supervisor` = admin de equipo? Si es así, alcanza con documentarlo y reforzar `profiles_admin_all`. Si `admin` debe ser el admin de equipo, hay que reescribir esas políticas con un `auth_is_admin_principal() OR (asesor_id IN (SELECT asesor_id FROM admin_asesores WHERE admin_id = auth.uid()))`.

---

### C-3. Escalada de privilegios vía `profiles_admin_all`

`profiles_admin_all` es `ALL ... USING auth_is_admin() WITH CHECK auth_is_admin()`. Un `admin` puede hacer `UPDATE profiles SET role='admin_principal' WHERE id = <su propio id>`. No hay `RESTRICTIVE` ni chequeo que impida tocar la columna `role` de un `admin_principal`.

**Fix:** política `RESTRICTIVE` que solo permita cambiar `role` si `auth_is_admin_principal()`, y que impida degradar a un `admin_principal`.

---

## HIGH

### H-1. `workflows` y `instancias_whatsapp` legibles por todo autenticado

```sql
workflows:            SELECT USING (true)   -- expone n8n_workflow_id, webhook_url, triggers
instancias_whatsapp:  SELECT USING (true)   -- expone webhook_url, metadata, numero_whatsapp
```

Cualquier asesor logueado puede leer los webhooks de n8n y de Evolution API y dispararlos desde afuera del CRM. `metadata` (jsonb) suele terminar guardando tokens.

**Fix:** restringir a `auth_is_admin()`; o exponer solo las columnas no sensibles vía vista `security_invoker`.

---

### H-2. `search_path` mutable en 6 funciones

Ninguna de estas tiene `SET search_path`:

| Función | `SECURITY DEFINER` |
|---|---|
| `auth_is_admin` | sí |
| `auth_is_admin_principal` | sí |
| `auth_is_supervisor` | sí |
| `handle_new_user` | sí |
| `set_updated_at` | no (invoker) |
| `set_lead_assigned_at` | no (invoker) |

Las cuatro primeras son las que sostienen **todo** el modelo de permisos: si alguien logra influir el `search_path`, `public.profiles` puede resolver a otra tabla y `auth_is_admin()` devolver `true`. Las dos últimas son triggers `SECURITY INVOKER` — riesgo bastante menor, pero el fix cuesta lo mismo.

**Fix:** `ALTER FUNCTION public.auth_is_admin() SET search_path = public, pg_temp;` (y las otras cinco). Incluido en `supabase/migrations/20260808_rls_audit_bloque1.sql`.

---

### H-3. `handle_new_user()` es invocable por `anon` vía RPC

Función `SECURITY DEFINER` que escribe en `profiles`, expuesta en `/rest/v1/rpc/handle_new_user` con `EXECUTE` para `anon` y `authenticated`. Es una trigger function: no debería ser callable.

**Fix:** `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;`

---

### H-4. `leads_supervisor_update` tiene un `WITH CHECK` que no valida nada útil

```sql
USING      (auth_is_supervisor() AND (assigned_to = auth.uid() OR assigned_to IS NULL OR assigned_to IN (equipo)))
WITH CHECK (auth_is_supervisor())
```

El `WITH CHECK` solo verifica que sigas siendo supervisor. Un supervisor puede tomar un lead de su equipo y reasignarlo a un asesor de **otro** equipo, o dejarlo en `NULL` (lo que lo vuelve visible para toda la agencia, ver H-5). El `WITH CHECK` debería repetir la condición del `USING`.

---

### H-5. Todo asesor ve los leads sin asignar

`leads_asesor_select`: `USING (assigned_to = auth.uid() OR assigned_to IS NULL)`.

Con asignación manual, la bandeja de leads sin asignar es justamente lo que el admin todavía no repartió. Hoy cualquier asesor la ve completa (datos de contacto de los prospectos). Y `leads_asesor_insert` permite crear leads con `assigned_to = NULL`, o sea autoservirse al pool.

**Fix:** sacar el `OR assigned_to IS NULL` del SELECT de asesor y dejar el pool solo para admin/supervisor.

---

## MEDIUM

### M-1. Escalas comisionales visibles para todos los asesores

`prepaga_comision_reglas` y `cierres_comisionales` tienen `SELECT USING (true)`. Todo asesor ve las escalas completas de la agencia y el estado de los lotes de liquidación de todas las prepagas. Es información comercial sensible, aunque no sea PII.

### M-2. `profiles_select USING (true)`

Todo autenticado lee email, `role` y `codigo_productor` de todos. Facilita enumerar quién es admin antes de atacar. **Fix:** limitar a uno mismo + los de su equipo + admins.

### M-3. `configuracion_global` legible por todos

Tabla `clave/valor` con `SELECT USING (true)`. Si en algún momento guarda una API key, queda expuesta a cualquier asesor.

### M-4. Políticas legacy que chequean `role = 'admin'` literal

`automation_logs`, `configuracion_global`, `instancias_whatsapp`, `workflows`, `conversaciones`, `conversacion_mensajes`, `lead_cotizaciones` y `admin_asesores` usan `EXISTS (SELECT 1 FROM profiles WHERE role = 'admin')` en vez de `auth_is_admin()`. Resultado: **`admin_principal` queda afuera** de esas tablas. Bug funcional + modelo de seguridad inconsistente (dos fuentes de verdad).

### M-5. `lead_cotizaciones` y `admin_asesores` con políticas `TO public`

`TO public` incluye a `anon`. Hoy no filtra porque `auth.uid()` es `NULL`, pero es una defensa que depende de un accidente. Deberían ser `TO authenticated`.

### M-6. Ninguna tabla tiene `FORCE ROW LEVEL SECURITY`

Las 27 tablas están sin `FORCE`. No afecta a `service_role` (tiene `BYPASSRLS` de todos modos), pero sí a conexiones directas como owner `postgres` y a futuras funciones/Edge Functions que corran como owner.

**Trade-off:** activar `FORCE` puede romper triggers y funciones internas que hoy dependen del bypass del owner. Aplicar tabla por tabla y probar, no en bloque.

---

## LOW

- **L-1.** `prepaga_credenciales` tiene RLS sin políticas → deny-all para `anon`/`authenticated`. Es el comportamiento deseado (se lee solo con service role), pero conviene dejarlo explícito con un comentario en la migración para que no parezca un olvido.
- **L-2.** `admin_asesores` tiene dos políticas ALL solapadas (`Admins can manage admin_asesores` legacy + `admin_asesores_all`). Borrar la legacy.
- **L-3.** `prepaga_eventos` solo tiene política de admin (ALL). Los asesores no pueden leer los calendarios de cierre/pago desde el cliente — funciona hoy solo si se consulta server-side.
- **L-4.** `supervisor` no tiene políticas en `altas`, `comisiones` ni `lead_cotizaciones`: ve los leads de su equipo pero no sus ventas ni comisiones. Gap funcional respecto del módulo de seguimiento.
- **L-5.** Auth: protección contra contraseñas filtradas (HaveIBeenPwned) está desactivada.

---

## Orden sugerido de remediación

1. **C-1** — es el único explotable sin credenciales. Un `ALTER VIEW` + `REVOKE`, riesgo de romper nada: bajo.
2. **H-2, H-3** — dos migraciones de una línea cada una, sin impacto funcional.
3. **C-3, H-4, H-5** — tocan políticas existentes; requieren probar los flujos de asignación y del panel admin.
4. **C-2** — necesita tu decisión sobre qué rol es "admin de equipo" antes de escribir SQL.
5. **H-1, M-1 a M-6** — endurecimiento, se puede agrupar en una migración.
6. **M-6 (`FORCE`)** — último, tabla por tabla.

Ninguno de estos cambios se aplicó. La skill `rls-audit` puede generar la migración de fix (`supabase/migrations/<ts>_rls_audit_fixes.sql`) cuando decidas el alcance.
