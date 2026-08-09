# Modelo de roles y visibilidad — CRM Nexo Agencia

**Fecha:** 2026-08-08
**Estado:** implementado. Fases A, B y C aplicadas y validadas el 2026-08-08.

| Fase | Qué | Estado |
|---|---|---|
| A | Schema: `comisiones` N:1, `supervisor_overrides`, `solo_lectura` | ✅ aplicada |
| B | Helpers + 23 políticas RLS reescritas | ✅ aplicada y testeada por rol |
| C | Generador de overrides al aprobar un alta | ✅ implementado |
| — | Código: dejar que el RLS defina el alcance | ✅ |
| D | Selector de alcance, pantallas de líder, carga de overrides | ⏳ pendiente |

Prueba de aceptación corrida sobre datos reales (base 1000, la agencia gana 100):

```
Venta del asesor      → directa asesor 100 · override líder 10
Venta de Carolina     → directa 100 · override propio 5   (admin + líder + vendedora)

asesor   ve 2 filas · cobra $50.100 · NO ve el override de su líder
líder    ve 2 filas · cobra $10
Carolina ve todo (admin) · cobra $105
```
**Relacionado:** `AUDITORIA_RLS_2026-08-08.md` (resuelve C-2, C-3, H-4, H-5, L-4)

---

## 1. Los cuatro niveles

La jerarquía es **estrictamente anidada**: cada nivel ve todo lo del nivel inferior más lo propio. No hay visibilidad cruzada entre ramas. Esto permite escribir una sola política de SELECT por tabla, con un `OR` por nivel.

| Nivel (`profiles.role`) | Quién es hoy | Alcance |
|---|---|---|
| `admin_principal` | Nexo (Rodri, Nico) | Todo. Único que gestiona roles, escalas comisionales y overrides. |
| `admin` | Carolina Ferrari | **Todos los equipos**, sin filtro. Asigna leads a cualquiera, aprueba ventas, ve liquidaciones por asesor / supervisor / equipo. |
| `supervisor` | líderes de equipo | Su equipo (vía `admin_asesores`) más lo propio. Asigna leads del pool a sus asesores. |
| `asesor` | — | Solo lo suyo. |

**Nomenclatura:** el valor en la base queda `supervisor` (ya existe `auth_is_supervisor()` y la migración `20260804_supervisor_rol.sql`; renombrar es costo sin beneficio). En la UI se muestra **"Líder"**. Separar el valor de DB de la etiqueta permite cambiarle el nombre después sin tocar una política.

---

## 1.1 El caso Carolina — el rol acumulado

Carolina es admin, supervisora y asesora a la vez. Esto **no** requiere una tabla de roles N:M, pero tampoco se resuelve solo con la jerarquía anidada. Hay que separar tres cosas que hoy están mezcladas en la columna `role`:

| Dimensión | Qué responde | De dónde sale |
|---|---|---|
| **Rol** | Hasta dónde ve y qué puede hacer | `profiles.role` (una sola columna, el nivel más alto) |
| **Relación** | Qué cobra | `supervisor_asesores` + `supervisor_overrides` |
| **Scope de vista** | Qué está mirando en este momento | Selector en la UI, no persiste permisos |

### Rol: sí se subsume

"Cumplir la función de asesor" no es un permiso, es un dato: que se le puedan asignar leads (`leads.assigned_to = su id`) y que genere comisiones propias (`comisiones.beneficiario_id = su id`). Como `admin` ya ve y puede todo lo que vería como supervisora o asesora, la jerarquía anidada lo cubre. `profiles.role = 'admin'` y listo.

### Relación: acá NO se subsume — y es donde estaba el agujero

Si el generador de comisiones pregunta `if role == 'supervisor' then emitir override`, **Carolina no cobra override sobre las ventas de su equipo**, porque su `role` dice `admin`. Es un bug de plata que no tira error: simplemente falta una fila en la liquidación.

La regla que lo evita:

> **El override no se dispara por rol. Se dispara por relación.**

Al aprobar un alta, el generador busca quién figura como `supervisor_id` del vendedor en `supervisor_asesores` y si esa persona tiene fila en `supervisor_overrides` para esa prepaga. Si la tiene, emite el override — sin mirar `profiles.role` en ningún momento. Carolina cobra porque tiene equipo y tiene override configurado, no porque su rol diga `supervisor`.

Dos consecuencias de diseño:

- **`supervisor_asesores.supervisor_id` no puede llevar un CHECK contra `role = 'supervisor'`.** Parece una constraint sana y rompería exactamente este caso.
- El mismo principio aplica al RLS: las políticas de equipo deben filtrar por `supervisor_id = auth.uid()` **a secas**, sin acompañarlo de `auth_is_supervisor()`. La pertenencia a la relación ya es la autorización; agregar el chequeo de rol lo vuelve frágil sin ganar nada. (El borrador anterior de este documento tenía ese error en el helper.)

Beneficio lateral: si mañana Carolina deja de ser admin pero conserva su equipo, cambia una columna y todo lo demás —equipo, overrides, historial— sigue funcionando.

### Scope de vista: es un problema de UI, no de RLS

Con un solo rol, Carolina entra y ve la agencia entera. Sus siete leads propios quedan perdidos entre los quinientos del consolidado, y su conversión personal, la de su equipo y la de la agencia son tres números distintos que hoy se muestran como uno.

Esto **no se arregla con políticas** — el RLS ya le da acceso a todo, correctamente. Se arregla con un selector de alcance en la UI:

```
[ Mi cartera ]  [ Mi equipo ]  [ Toda la agencia ]
```

Filtra la query del lado del cliente sobre datos a los que ya tiene derecho. Aplica al embudo, al dashboard y a las liquidaciones. El default razonable es "Toda la agencia" para admin y "Mi equipo" para supervisor, con la opción siempre disponible de bajar a "Mi cartera".

Que aparezca como opción **solo si tiene algo que mostrar**: "Mi equipo" si tiene filas en `supervisor_asesores`, "Mi cartera" si tiene leads asignados. Otra vez, dirigido por relación y no por rol.

### Lo que hay que corregir en el código

La suposición implícita de que un admin no vende:

- que aparezca en los selectores de asignación de leads
- que su embudo propio sea visible además del consolidado
- que figure en las liquidaciones como beneficiario, no solo como quien liquida

---

## 2. Cambios de schema necesarios

### 2.1 `comisiones` — de 1:1 a N:1 con el alta

Hoy `comisiones` es 1:1 con el alta aprobada y tiene un solo `asesor_id`. Con override, **una venta genera dos o más filas**: la directa del asesor y la del supervisor.

Columnas a agregar:

| Columna | Tipo | Para qué |
|---|---|---|
| `beneficiario_id` | `uuid → profiles` | Quién cobra esta fila. **Es la columna sobre la que filtra el RLS.** |
| `tipo` | `text` (`directa` \| `override`) | Distingue comisión propia de override. Extensible a más niveles. |
| `vendedor_id` | `uuid → profiles` | Quién hizo la venta. En `directa` coincide con `beneficiario_id`. |
| `supervisor_id` | `uuid → profiles`, nullable | **Snapshot** del supervisor al momento de generar la comisión. |

Backfill de las filas existentes: `beneficiario_id = asesor_id`, `vendedor_id = asesor_id`, `tipo = 'directa'`.

La constraint de unicidad pasa de `unique(alta_id)` a `unique(alta_id, beneficiario_id, tipo)`.

Migrar en tres pasos —agregar columnas y backfillear, cambiar el código, recién después dropear `asesor_id`— para no romper el módulo de comisiones en producción a mitad de camino.

#### Por qué el `supervisor_id` congelado no es opcional

Las ventas históricas quedan con el asesor. Si el RLS calculara la visibilidad del supervisor contra el `admin_asesores` **actual**, mover un asesor de equipo le reescribiría el pasado a dos supervisores a la vez: uno pierde de la vista liquidaciones que ya cobró, el otro pasa a ver ventas que nunca fueron suyas. Congelar el supervisor en la fila lo evita, y además hace que la liquidación por equipo sea reproducible meses después.

Mismo criterio para el porcentaje: la fila ya guarda el snapshot de la regla, y el override tiene que guardar su `pct` igual, no leerlo de la tabla de configuración al liquidar.

### 2.2 `supervisor_overrides` — tabla nueva

El override se define **por supervisor y por prepaga**. Es un grano distinto al de `prepaga_comision_reglas` (que es de la agencia: prepaga + segmento + origen), así que va en tabla propia. La forma es la misma que ya tiene `prepaga_asesores.comision_pct`, o sea que hay precedente en el schema.

```
supervisor_overrides
  supervisor_id       uuid → profiles
  prepaga_id          uuid → prepagas
  pct_equipo          numeric        -- override sobre ventas de sus asesores
  pct_venta_propia    numeric NULL   -- override sobre sus propias ventas; NULL = no cobra
  vigente_desde       date
  activo              boolean
  unique (supervisor_id, prepaga_id, vigente_desde)
  check (pct_venta_propia is null or pct_venta_propia > 0)
```

`vigente_desde` permite cambiar un porcentaje sin alterar lo ya devengado. Solo `admin_principal` escribe en esta tabla.

#### `pct_venta_propia`: el campo nulo *es* el interruptor

El líder cobra override también sobre lo que vende él mismo, y tiene que poder configurarse por persona y por prepaga. La forma de modelarlo es **una sola columna nullable**, no un booleano `aplica_venta_propia` más un porcentaje:

- `pct_venta_propia = 3.5` → cobra 3,5% de override sobre su propia venta
- `pct_venta_propia = NULL` → no cobra override sobre venta propia

Con el par booleano + porcentaje existen estados contradictorios (`aplica = true` con `pct = NULL`, o `aplica = false` con un porcentaje cargado que alguien va a leer por error). Con una columna nullable, cargar el porcentaje **es** activarlo, y el estado inconsistente no se puede representar. El `CHECK` cierra el caso del cero ambiguo.

Es una columna aparte de `pct_equipo` y no el mismo valor, porque no hay razón para que el override sobre producción propia coincida con el que se cobra por conducir a otro — y si coinciden, se carga el mismo número.

**Etiqueta sugerida en la UI:** "Override sobre producción propia", para que no se lea como un segundo porcentaje de la escala de asesor.

### 2.2.1 El generador de comisiones

Al aprobar un alta con vendedor `V` y prepaga `P`, se emiten hasta tres filas:

```
1. DIRECTA
   beneficiario = V, vendedor = V
   pct = prepaga_comision_reglas(P, segmento, origen)

2. OVERRIDE DE EQUIPO
   S = supervisor de V en supervisor_asesores
   si S existe, S ≠ V, y supervisor_overrides(S, P).pct_equipo no es null:
     beneficiario = S, vendedor = V, supervisor_id = S
     pct = pct_equipo

3. OVERRIDE SOBRE VENTA PROPIA
   si supervisor_overrides(V, P).pct_venta_propia no es null:
     beneficiario = V, vendedor = V, supervisor_id = V
     pct = pct_venta_propia
```

Los pasos 2 y 3 son independientes: uno mira al supervisor del vendedor, el otro mira al vendedor mismo. La guarda `S ≠ V` del paso 2 evita la doble emisión si alguien llegara a figurar como supervisor de sí mismo en `supervisor_asesores` — ese caso lo cubre el paso 3, que es el correcto.

Los tres pasos leen `supervisor_overrides` y `supervisor_asesores`; **ninguno lee `profiles.role`**. Es lo que hace que Carolina cobre sus tres conceptos sin que su rol de `admin` interfiera.

Una venta propia de Carolina genera entonces **dos filas con el mismo beneficiario** (una `directa` y una `override`). La constraint `unique (alta_id, beneficiario_id, tipo)` lo permite y sigue impidiendo duplicados reales. En la liquidación conviene mostrarlas agrupadas por venta, o va a parecer que la venta se pagó dos veces.

Como siempre, cada fila guarda el `pct` del momento: cambiar un override no altera lo ya devengado.

**Preparado para el override de admin sin activarlo:** dejar `tipo` en `comisiones` como texto (no enum) y agregar una columna `nivel` en la regla. El día que se defina si el admin cobra sobre sus supervisores, es una fila nueva y una rama más en el generador — no una migración de datos.

### 2.3 `admin_asesores` — el nombre quedó mentiroso

La tabla guarda hoy la relación **supervisor → asesor**, pero la columna se llama `admin_id`. Como el admin ve todos los equipos, no necesita ninguna relación: esta tabla es exclusivamente de supervisores.

Renombrarla a `supervisor_asesores` (`supervisor_id`, `asesor_id`) mientras se reescriben las políticas del Bloque 2/3 de la auditoría. Si se deja así, cada política nueva que alguien escriba va a leer `admin_id` y asumir que filtra admins.

### 2.4 `profiles.solo_lectura` — anticipar al colaborador externo

Para el contable o administrativo futuro: en vez de un rol nuevo, una columna booleana que hace **ortogonales la visibilidad y la escritura**. Se le da el nivel que corresponda (`admin`, por ejemplo) y `solo_lectura = true`.

Cuesta una columna y una condición en las políticas de escritura, que de todos modos se van a reescribir. Retrofitearlo después cuesta revisar todas las políticas de nuevo.

---

## 3. Forma canónica de las políticas

### Helper de alcance

En lugar de repetir la lógica de jerarquía en cada política, un único helper:

```sql
CREATE OR REPLACE FUNCTION public.auth_puede_ver_asesor(target uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth_is_admin()                    -- admin + admin_principal: todos los equipos
    OR target = auth.uid()             -- lo propio
    OR EXISTS (                        -- su equipo: por relación, no por rol
          SELECT 1 FROM supervisor_asesores
          WHERE supervisor_id = auth.uid() AND asesor_id = target)
$$;
```

**Por qué no lleva `auth_is_supervisor()`:** si la rama del equipo exigiera además que el rol sea `supervisor`, Carolina —que es `admin` con equipo a cargo— quedaría fuera de esa rama. Hoy no se nota porque `auth_is_admin()` la cubre por arriba, pero el día que se le acote el alcance al admin deja de verse el equipo propio. Estar en `supervisor_asesores` ya es autorización suficiente; el chequeo de rol solo agrega fragilidad.

**Por qué un helper y no la condición inline:** la decisión de que el admin vea todos los equipos vale mientras haya un solo admin. Si mañana entra un segundo que no debe ver la cartera del primero, con el helper se toca un lugar; inline, se tocan quince políticas y alguna se olvida.

Nótese el `SET search_path` — es el fix de H-2 de la auditoría, y toda función nueva `SECURITY DEFINER` tiene que nacer con él.

### Comisiones

```sql
USING (
  auth_is_admin()
  OR beneficiario_id = auth.uid()      -- directa y override propio
  OR supervisor_id = auth.uid()        -- equipo, por snapshot y por relación
)
```

El supervisor ve las comisiones de su equipo por el **snapshot**, no por la membresía actual. Y la segunda línea es la que hace que Carolina vea sus dos tipos de fila —la directa de sus ventas y el override de las de su equipo— con la misma política, sin ninguna rama especial. Escritura: solo `auth_is_admin()`, como hoy.

### Leads

```sql
USING (
  auth_puede_ver_asesor(assigned_to)
  OR (assigned_to IS NULL AND auth_puede_asignar())
)
```

La segunda línea es el fix de **H-5**: el pool de leads sin asignar queda visible solo para quien reparte. Hoy lo ve cualquier asesor.

`auth_puede_asignar()` = es admin **o** tiene al menos un asesor a cargo en `supervisor_asesores`. Otra vez por relación: quien tiene equipo puede repartir, tenga el rol que tenga.

Para el UPDATE, el `WITH CHECK` tiene que **repetir la condición del `USING`** — el fix de **H-4**. Hoy el `WITH CHECK` de `leads_supervisor_update` solo valida `auth_is_supervisor()`, lo que deja a un supervisor reasignar un lead de su equipo a otro equipo, o dejarlo en `NULL`.

### Profiles — cerrar la escalada (C-3)

`auth_is_admin()` no puede seguir habilitando el cambio de `role`, o cualquier admin se promueve a `admin_principal`. Va una política **`RESTRICTIVE`** aparte:

```sql
CREATE POLICY profiles_role_solo_principal ON profiles
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (role = (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 0)
       OR auth_is_admin_principal());
```

(La forma exacta se ajusta al implementar; el punto es que la columna `role` quede detrás de `auth_is_admin_principal()` con una política restrictiva, no permisiva.)

### Nota de performance

Envolver las llamadas en subselect — `(SELECT auth_is_admin())` en vez de `auth_is_admin()` — hace que Postgres las evalúe una vez como InitPlan en lugar de una vez por fila. En `leads` y `comisiones`, que son las tablas que más crecen y las que alimentan el dashboard, la diferencia es grande. Es el cruce entre seguridad y performance que cubre la skill `postgres-best-practices`.

Además, índice en `comisiones (beneficiario_id)` y `comisiones (supervisor_id)`: son las columnas del predicado de RLS y sin índice cada consulta del dashboard es un seq scan filtrado.

---

## 4. Matriz de capacidades

| Acción | asesor | supervisor | admin | admin_principal |
|---|:--:|:--:|:--:|:--:|
| Ver sus propios leads | ✅ | ✅ | ✅ | ✅ |
| Ver leads del equipo | — | ✅ | ✅ | ✅ |
| Ver pool sin asignar | — | ✅ | ✅ | ✅ |
| Asignar leads | — | ✅ (su equipo) | ✅ (todos) | ✅ |
| Cotizar / dar de alta | ✅ | ✅ | ✅ | ✅ |
| Aprobar ventas | — | ❔ | ✅ | ✅ |
| Ver comisiones propias | ✅ | ✅ | ✅ | ✅ |
| Ver comisiones del equipo | — | ✅ | ✅ | ✅ |
| Cobrar override sobre el equipo | — | ✅ | ✅ (si tiene equipo) | ❔ |
| Cobrar override sobre venta propia | — | ✅ configurable | ✅ configurable | ✅ configurable |
| Gestionar escalas y overrides | — | — | — | ✅ |
| Cambiar roles de usuarios | — | — | — | ✅ |

❔ = pendiente de definir.

---

## 5. Pendientes de definición

> ### ✅ RESUELTO: sobre qué se calcula el override
>
> **Todos los porcentajes del sistema están en la misma unidad: % de la cuota.**
> Son escalas independientes que se restan, nunca se multiplican entre sí.
>
> ```
> facturación NEXO   =  cuota × pct de la prepaga    (260% → 130.000)
> pago al asesor     =  cuota × pct del asesor       (180% →  90.000)
> override del líder =  cuota × pct_equipo
> margen NEXO        =  facturación − suma de todos los pagos de esa venta
> ```
>
> La versión original multiplicaba el porcentaje de la prepaga por el del
> asesor, lo que solo tiene sentido si el segundo es una porción del primero.
> Con ambos sobre la cuota, multiplicar daba absurdos: 50.000 × 2,6 × 1,8 =
> 234.000. Corregido en `generarComisionParaAlta()`.


1. **¿El supervisor aprueba ventas de su equipo, o solo admin para arriba?** No quedó cubierto. Cambia una política de `altas`.
2. **¿El admin cobra override sobre sus supervisores?** Queda preparado en el schema, sin activar.
3. ~~Carolina vendiendo como asesora~~ — **resuelto**: cobra la escala de asesor por su venta **más** override sobre esa misma venta, configurable por persona y prepaga vía `supervisor_overrides.pct_venta_propia`. Ver 2.2 y 2.2.1.

---

## 6. Orden de implementación

Encaja dentro de los bloques de la auditoría:

1. **Bloque 1** de la auditoría (C-1, H-2, H-3) — independiente de todo esto, se puede hacer ya.
2. Migración de schema: `comisiones` (columnas + backfill), `supervisor_overrides`, rename de `admin_asesores`, `profiles.solo_lectura`.
3. Helper `auth_puede_ver_asesor()` + reescritura de políticas de `leads`, `comisiones`, `altas`, `activities`, `lead_cotizaciones` (cierra C-2, C-3, H-4, H-5, L-4).
4. Generador de comisiones: emitir la fila de override al aprobar el alta.
5. Código: selectores de asignación que incluyan admins y supervisores, vistas de liquidación por equipo.
6. Tests de RLS por rol (cuatro usuarios de prueba) y `rls-audit` de control.

Recién después, las fases nuevas.
