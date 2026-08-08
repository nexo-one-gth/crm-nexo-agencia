# Checkpoint UI 1 — smoke test con los 4 roles

**Fecha:** 2026-08-08
**Estado del código:** Fase A aplicada, rol supervisor habilitado, `tsc` limpio.

## Qué se está probando acá

Fase A fue **aditiva**: no tocó ninguna política ni ninguna query existente. Así que la hipótesis a falsear es simple: **nada tiene que verse distinto que ayer**. Si algo cambió, es un bug introducido en este bloque.

Lo valioso de este checkpoint no es confirmar que nada se rompió — es **descubrir qué falta**. Sobre todo para el rol `supervisor`, que hasta hoy no existía como usuario real en el sistema.

Y hay un flujo que se prueba por primera vez contra la base real: el de altas con Google Drive. La migración que lo soportaba estuvo sin aplicar, así que ese código nunca corrió.

---

## Paso 1 — Crear los usuarios de prueba

Desde `/admin`, logueado como **admin_principal**. El selector de rol ahora ofrece "Líder de Equipo".

| Usuario | Rol | Para qué |
|---|---|---|
| `test.asesor@nexo.com` | asesor | el caso más restringido |
| `test.lider@nexo.com` | supervisor | **nunca existió** — todas sus políticas están sin estrenar |
| `test.admin@nexo.com` | admin | ve todos los equipos |
| (el actual) | admin_principal | control |

Después de crearlos, asignarle 2 o 3 asesores al líder desde la pantalla de equipos.

> Ojo: la relación se guarda en `admin_asesores`, cuya columna se llama `admin_id` pero contiene al líder. El rename a `supervisor_asesores` va en Fase B.

---

## Paso 2 — Verificar que nada se rompió (los 4 roles)

Con cada usuario, entrar y confirmar que se ve lo mismo que antes:

- [ ] `/` — el dashboard carga y las métricas dan números coherentes
- [ ] `/leads` — el listado carga
- [ ] `/funnel` — el Kanban carga y el drag & drop persiste
- [ ] `/prepagas` — **crítico**: acá pegó el fix C-1. Un asesor tiene que seguir viendo exactamente sus prepagas asignadas, ni más ni menos
- [ ] `/prepagas/[slug]/cotizar` — el cotizador sigue devolviendo credenciales
- [ ] `/comisiones` — el asesor ve sus comisiones
- [ ] `/settings` — el perfil carga y se puede editar el nombre

Y con **admin_principal**:

- [ ] `/admin` — gestión de asesores
- [ ] `/admin/prepagas` — el listado de asesores por prepaga (también pasa por la vista del fix C-1)
- [ ] `/admin/comisiones` — los lotes de cierre

---

## Paso 3 — El circuito de altas con Drive (nunca corrió)

Este es el que más probabilidades tiene de fallar, y no por algo que hayamos hecho hoy.

- [ ] Iniciar un alta desde un lead
- [ ] ¿Se crea la carpeta en Drive? (`altas.drive_folder_id` se completa)
- [ ] Cargar integrantes (titular + un familiar) → verificar que persisten
- [ ] Subir un archivo del checklist → ¿queda `alta_items.drive_file_id`?
- [ ] Generar el resumen del trámite

Si algo de esto falla, **no es regresión** — es la primera vez que se ejecuta. Anotarlo y seguir; se arregla aparte.

---

## Paso 4 — Verificación de seguridad (el fix de C-3)

Logueado como **admin** (no principal), en `/admin`:

- [ ] No debería poder editar ni borrar al usuario admin_principal
- [ ] Si intenta cambiar un rol, la base lo rechaza con "Solo admin_principal puede cambiar el rol de un usuario"

> Hoy la UI ni siquiera ofrece cambiar roles después de crear, así que lo más probable es que no haya nada que clickear. La defensa está en la base y ya la validé con tests SQL; esto es solo confirmar que la UI no expone un camino que no vimos.

---

## Paso 5 — Anotar lo que falta

Lo que ya sé que va a aparecer, para que no sorprenda:

| Hueco | Detalle |
|---|---|
| **El líder no entra a `/admin`** | La ruta exige `admin` o `admin_principal`. Un supervisor no tiene ninguna pantalla para gestionar su equipo. |
| **No hay vista "Mi equipo"** | Ni en leads, ni en comisiones. El líder ve sus propios leads y nada más. |
| **No hay dónde cargar los overrides** | `supervisor_overrides` existe en la base pero no tiene UI. Los porcentajes hoy solo se pueden cargar por SQL. |
| **No hay selector de alcance** | El caso Carolina: admin + líder + asesora a la vez, con sus 7 leads perdidos entre los 500 del consolidado. |
| **El líder no ve comisiones de su equipo** | Falta la política (Fase B) y la pantalla (Fase D). |

Anotar cualquier otro hueco que aparezca: eso define el alcance real de Fase D.

---

## Al terminar

Con esto cerrado, sigue **Fase B**: rename de `admin_asesores`, el helper `auth_puede_ver_asesor()` y la reescritura de políticas de `leads`, `altas`, `comisiones`, `activities` y `alta_integrantes`. Cierra C-2, H-4, H-5 y L-4 de la auditoría.

Antes de tocar la UI en Fase B corro la suite de tests SQL simulando PostgREST con los 4 roles, como se hizo con C-3. Así al Checkpoint 2 se llega con el RLS ya validado y lo que se prueba en pantalla es la aplicación, no las políticas.
