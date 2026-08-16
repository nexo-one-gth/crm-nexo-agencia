# 📋 Reporte de mejoras — Cotizadores, Prepagas y Vista de Supervisor

**Proyecto:** NEXO Salud — CRM Agencia
**Fecha:** 3 de agosto de 2026
**Alcance:** (1) lógica y trazabilidad de asignación de cotizadores, (2) prepagas con cotizadores, (3) vista de supervisor con reparto de leads a un grupo de asesores.

---

## Resumen ejecutivo

El CRM ya resuelve el 80% de cada uno de estos tres frentes, pero con deuda técnica concreta en cada uno:

1. **Cotizadores** — no existe un "cotizador asignado" como entidad propia. El cotizador vive pegado a la prepaga (`prepagas.tipo_cotizador`) y lo que realmente se asigna al asesor son las **credenciales por prepaga**. Falta trazabilidad de *cuándo se lanzó* un cotizador (hoy solo se registra si el asesor guarda la cotización).

2. **Prepagas con cotizadores** — hay 4 tipos (`integrado | externo | pdf | manual`) pero la lógica de cada uno está **hardcodeada por slug** (Sancor, Premedic, Avalian) y hay una **inconsistencia**: la página `/cotizar` dice "cotizador integrado en desarrollo" mientras que `PanelCotizacion` ya monta el cotizador interno de Premedic.

3. **Vista de supervisor (Carolina Ferrari)** — el rol `supervisor` **ya existe en el enum del schema** pero quedó huérfano: el código nunca lo cableó. Hoy un supervisor se tendría que crear como `admin`, lo que le da poderes globales que no debería tener (CRUD de prepagas, reglas de comisión, ver todo). Falta también el concepto de "lead asignado a un equipo, pendiente de reparto".

Prioridad sugerida: **Supervisor (alto)** → **Trazabilidad de cotizadores (medio)** → **Refactor declarativo de cotizadores (medio-bajo)**.

---

## 1. Lógica y trazabilidad de cómo se asignan los cotizadores

### Cómo funciona hoy

El cotizador **no es una entidad asignable**. La cadena real es:

- `prepagas` define el tipo de cotizador (`tipo_cotizador`), la URL (`cotizador_url`) y la carpeta de Drive (`drive_folder_id`).
- `prepaga_asesores` vincula asesor ↔ prepaga y guarda lo que sí es "por asesor": `credenciales` (usuario/clave en JSON), `codigo_productor` y `comision_pct`.
- Al abrir el cotizador, `getCredencialesCotizador(prepagaId)` lee las credenciales **solo server-side**, filtrando por el `asesor_id` del usuario logueado. Correcto desde seguridad.

Es decir: "asignar un cotizador a un asesor" hoy = "asignar la prepaga y cargarle sus credenciales" en `/admin/prepagas`.

### Problemas detectados

- **No hay traza del uso del cotizador.** Solo se registra actividad cuando el asesor **guarda** una cotización (`guardarCotizacion` → inserta en `lead_cotizaciones` + `activities`). Abrir el cotizador externo de Avalian, el PDF de Premedic o el login de Sancor **no deja ningún rastro**. No se puede responder "¿cuántas veces se cotizó y no se cerró?".

- **Credenciales en JSON plano.** `prepaga_asesores.credenciales` es un JSON sin cifrado real (el CLAUDE.md lo llama "encriptado" pero en el schema es un `jsonb` común). Están protegidas por RLS y por leerse server-side, pero no cifradas en reposo. La Fase 2 ya prevé Supabase Vault — conviene priorizarlo.

- **Sin validación de completitud.** Nada impide asignar una prepaga a un asesor sin cargarle credenciales. El asesor recién se entera al intentar cotizar y encontrarse el campo vacío. No hay un indicador "prepaga asignada pero sin credenciales".

- **La escala comisional depende del `origen` del lead, pero el cotizador no lo valida.** El asesor puede cotizar y dar de alta sin que `origen` esté seteado coherentemente, y la comisión recién falla (silenciosamente, con una activity `comision_sin_regla`) al aprobar el alta.

### Recomendaciones

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1.1 | Registrar una `activity` tipo `cotizador_abierto` (prepaga, asesor, lead, timestamp) cada vez que se lanza un cotizador externo/pdf/sancor. Da el embudo real cotización→cierre. | Alto | Bajo |
| 1.2 | Migrar `prepaga_asesores.credenciales` a **Supabase Vault** (ya previsto en Fase 2). Cifrado en reposo real. | Alto | Medio |
| 1.3 | Badge en `/admin/prepagas` y en la card del asesor: "asignada sin credenciales" / "completa". Evita asignaciones a medias. | Medio | Bajo |
| 1.4 | Al guardar cotización, si el lead no tiene `origen`, forzar selección o inferirlo. Cierra el hueco de `comision_sin_regla`. | Medio | Bajo |
| 1.5 | Tabla `cotizador_asignaciones` o vista materializada que resuma, por asesor, qué prepagas tiene, con/sin credenciales y última cotización. Base para reportes de productividad. | Medio | Medio |

---

## 2. Prepagas con cotizadores

### Cómo funciona hoy

Cuatro tipos de cotizador conviven, resueltos con `if (tipo_cotizador === ...)`:

- **`integrado`** — cotizador propio dentro del CRM. Hoy solo Premedic (`CotizadorInternoPremedic`, con cálculo de tarifa server-side en `calcularTarifaPremedic`).
- **`externo`** — abre la web del cotizador en pestaña nueva y muestra las credenciales para copiar (ej. Avalian).
- **`pdf`** — lista de precios servida desde la carpeta de Drive de la prepaga (`getCotizadorAcceso` → PDFs).
- **`manual`** — sin cotizador; carga a mano.
- **Caso especial Sancor** — no permite embeberse (bloquea por `X-Frame-Options`), así que se abre en pestaña nueva y se apoya en una **extensión de Chrome** (`sancor-autologin/`) que autocompleta el login.

### Problemas detectados

- **Inconsistencia entre las dos vistas del integrado.** `/prepagas/[slug]/cotizar` muestra el cartel *"El cotizador integrado está en desarrollo. Próximamente disponible."*, mientras que `PanelCotizacion` (desde el lead) **ya monta el cotizador Premedic funcional**. El asesor ve mensajes contradictorios según por dónde entre.

- **Lógica hardcodeada por slug/marca.** Sancor y Premedic están cableados a mano en componentes. Agregar una prepaga nueva con cotizador integrado obliga a tocar código, no es configuración. No escala a las 10+ prepagas del catálogo.

- **La extensión `sancor-autologin/` está fuera del control del proyecto.** No está versionada en git (aparece como carpeta sin trackear), no está documentada en el `CLAUDE.md` y depende de que cada asesor la instale manualmente. Si Sancor cambia el HTML del login, se rompe silenciosamente y nadie se entera.

- **Sin estado de salud del cotizador.** No hay forma de saber si el cotizador de una prepaga está operativo. Si Avalian cambia la URL o Premedic desactualiza las listas de Drive, se descubre por reclamo del asesor.

### Recomendaciones

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 2.1 | **Unificar la vista del integrado**: que `/cotizar` y `PanelCotizacion` usen el mismo componente/estado. Sacar el cartel "en desarrollo" si Premedic ya funciona. | Alto | Bajo |
| 2.2 | Registro declarativo de cotizadores: mover Sancor/Premedic de código a config en la fila de `prepagas` (ej. `cotizador_config jsonb` con `{ engine, requiere_extension, embebible }`). El componente elige el motor según config, no según slug. | Alto | Medio |
| 2.3 | **Versionar `sancor-autologin/`** dentro del repo (o repo aparte con README y versión), y documentarlo en `CLAUDE.md`. Agregar detección de cambios en el DOM del login para avisar si se rompe. | Medio | Bajo |
| 2.4 | Campo `cotizador_estado` (operativo/degradado/caído) editable por admin + fecha de última verificación de listas PDF. Muestra un aviso al asesor antes de cotizar. | Medio | Bajo |
| 2.5 | Checklist de "prepaga lista para operar": tiene tipo, URL/credenciales/Drive según corresponda, plantilla de checklist y regla de comisión. Un semáforo en `/admin/prepagas`. | Medio | Medio |

---

## 3. Vista de supervisor (ej. Carolina Ferrari) + reparto de leads al grupo

### Cómo funciona hoy

La jerarquía real cableada es **`admin_principal` > `admin` > `asesor`**:

- `admin` ve los leads de sus asesores mediante la tabla N:M `admin_asesores`, **más** los leads sin asignar de su equipo. Esto ya se parece muchísimo a lo que necesita un supervisor.
- `assignLeadsToAdvisor()` (el reparto de leads) exige `assertAdmin()` → **solo** admin o admin_principal pueden repartir.
- El `assigned_to` de un lead apunta a **un asesor** o a `null`. No existe un estado intermedio tipo "asignado al equipo de Carolina, todavía sin asesor final".

### El hallazgo clave

En `supabase/schema.sql` está declarado:

```sql
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'sales_executive', 'asesor');
```

El rol **`supervisor` ya existe en el enum**, pero **quedó huérfano**: el código nunca lo usa. Todo el sistema de permisos (`assert-admin.ts`, filtros de `getAllLeads`, etc.) razona con `'admin' | 'admin_principal' | 'asesor'`, que son *strings sueltos en una columna TEXT* — ni siquiera usan el enum. O sea: el modelo de roles del schema y el del código **divergieron**.

Esto es una buena noticia: la intención de tener supervisores ya estaba, solo falta implementarla bien.

### Qué necesita Carolina que hoy no tiene

1. **Ver solo su grupo** de asesores (no todos, como un admin global).
2. **Recibir leads asignados "al equipo"** y repartirlos entre sus asesores.
3. **NO** tener poderes de admin global (CRUD de prepagas, reglas de comisión, ver todos los equipos).

Hoy, para darle (1) y (2) habría que hacerla `admin`, lo que también le da (3) — que es justamente lo que no queremos.

### Recomendaciones

**Enfoque recomendado (A): promover `supervisor` a rol de primera clase.**

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 3.1 | Cablear `supervisor` en `assert-admin.ts`: nuevo helper `assertSupervisorOrAdmin()` y `isSupervisorRole()`. Un supervisor puede repartir leads **de su grupo**, pero no toca prepagas ni reglas de comisión. | Alto | Medio |
| 3.2 | Reusar `admin_asesores` como "equipo del supervisor" (renombrar mentalmente a "supervisor↔asesor") o crear `supervisor_asesores` si conviene separar de la jerarquía admin. Carolina queda como cabeza de su grupo. | Alto | Medio |
| 3.3 | Permitir asignar un lead **al supervisor** (no a un asesor final). Opción: `assigned_to` = Carolina + un flag/etapa "Pendiente de reparto". Ella lo ve en una bandeja y lo distribuye entre sus asesores. | Alto | Medio |
| 3.4 | Vista "Mi equipo" para el supervisor: leads sin repartir arriba, y por asesor abajo, con reparto por drag o selección múltiple (reusar `MassAssignDialog`, hoy admin-only). | Alto | Medio |
| 3.5 | Ajustar `getAllLeads`: rama nueva para `supervisor` = leads de sus asesores + leads asignados a ella sin repartir. Análogo a la rama `admin` actual, pero acotado a su grupo. | Alto | Bajo |
| 3.6 | Reparto equitativo opcional ("round-robin"): botón "repartir N leads entre mi equipo" que balancea automáticamente. Bueno para campañas grandes. | Medio | Medio |
| 3.7 | Unificar el modelo de roles: migrar la columna `profiles.role` (TEXT) al enum real y consolidar `admin_principal`/`supervisor`. Elimina la divergencia schema↔código. | Medio | Medio |

**Enfoque alternativo (B): "admin acotado".** Reusar el rol `admin` tal cual pero agregar un scope que le impida las rutas globales (`/admin/prepagas`, `/admin/comisiones`). Menos limpio conceptualmente pero más rápido si urge. No recomendado como solución final porque perpetúa la divergencia de roles.

### Flujo objetivo para Carolina

```
1. Admin principal importa 200 leads de una campaña.
2. En lugar de asignarlos uno a uno, los asigna al EQUIPO de Carolina
   (assigned_to = Carolina, etapa "Pendiente de reparto").
3. Carolina entra a "Mi equipo" → ve 200 leads sin repartir.
4. Reparte (manual, masivo o round-robin) entre sus 5 asesores.
5. Cada asesor ve solo los suyos; Carolina ve el avance de todo su grupo.
6. Carolina NO puede tocar prepagas, reglas de comisión ni otros equipos.
```

---

## Priorización global sugerida

**Sprint 1 (rápidas y de alto valor)**
- 2.1 Unificar vista del cotizador integrado (saca la contradicción visible al asesor).
- 1.1 Trazar apertura de cotizadores.
- 3.5 + 3.1 Base del rol supervisor (helper + filtro de leads).

**Sprint 2 (el grueso de supervisor)**
- 3.2, 3.3, 3.4 Equipo, lead al equipo y bandeja de reparto.
- 2.3 Versionar y documentar la extensión de Sancor.

**Sprint 3 (robustez y escala)**
- 1.2 Credenciales a Vault.
- 2.2 Cotizadores declarativos por config.
- 3.6 / 3.7 Round-robin y unificación del enum de roles.

---

## Notas de deuda técnica transversal

- **Roles divergentes**: el schema tiene un enum (`admin/supervisor/sales_executive/asesor`) que el código ignora, usando strings (`admin/admin_principal/asesor`) sobre una columna TEXT. Conviene consolidar antes de sumar el supervisor, para no acumular una tercera capa.
- **`sancor-autologin/` sin versionar**: dependencia crítica del flujo de Sancor viviendo fuera de git.
- **Credenciales "encriptadas" que no lo están**: el `CLAUDE.md` afirma cifrado que el schema no implementa. Alinear documentación y realidad.
