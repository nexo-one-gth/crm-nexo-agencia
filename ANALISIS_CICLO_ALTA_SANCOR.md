# Panorama — ciclo lead → cotización → alta → envío a procesar

Fecha: 2026-08-27 · Caso testigo: **TELLERIA CLOSSA NAZARENO IVAN** (SANCOR SALUD, desregulado, 1 cápita)
Continúa `ANALISIS_TRAZABILIDAD_PREPAGAS.md` (2026-08-22). Diagnóstico, sin cambios de código.

---

## 0. Resumen en una línea

**La infraestructura para "según la prepaga cambia la carga" ya está construida y está vacía.**
No hay que construirla: hay que configurarla, conectarla a la cotización y ponerle un
paso de envío que valide.

---

## 1. Lo que ya existe y funciona

| Pieza | Dónde | Estado |
|---|---|---|
| Datos comerciales del trámite | `altas.plan_codigo, cantidad_capitas, cuota, aportes_promedio, sueldo_bruto, periodo_aportes, medio_pago` | ✅ tabla + UI (`DatosComerciales.tsx`) |
| Titular + grupo familiar | `alta_integrantes` (dni, cuil, fecha_nac, edad, peso, altura, domicilio, tel, email) | ✅ tabla + UI + RLS propia |
| Campos dinámicos por prepaga | `checklist_plantilla_items.seccion = 'datos'` → snapshot en `alta_items.seccion` | ✅ mecanismo + UI (`DatosEspecificos.tsx`) |
| Documentos por prepaga | `alta_items` sección `documentos` + subida a Drive por ítem | ✅ `subirAdjuntoDrive()` |
| Carpeta de Drive por trámite | `altas.drive_folder_id/url`, creada al iniciar el alta | ✅ best-effort |
| Solicitud de alta (resumen) | `checklist_plantillas.resumen_template` con `{{variables}}` → `generarResumenAlta()` → texto + Doc en Drive | ✅ motor + editor en `/admin/prepagas` |
| Ciclo de estados | en_proceso → enviada → observada → aprobada/rechazada, con `activity` por cambio | ✅ |

Es decir: **el 80% del ciclo que pedís ya está codeado.**

---

## 2. El problema: está construido pero desconectado y sin configurar

### 2.1 Las 10 prepagas comparten la misma plantilla genérica

Consulta sobre producción:

```
checklist_plantilla_items WHERE seccion = 'datos'   →  0 filas
checklist_plantillas WHERE resumen_template IS NOT NULL  →  0 de 10
```

Las 10 prepagas tienen una plantilla llamada literalmente **"Alta estándar"** con los
mismos 8 ítems (7 en Premedic). El seed de SANCOR de la migración
`20260804_alta_carpeta_drive_integrantes.sql` **quedó como no-op** (ya había plantilla
activa, la genérica) — está documentado en el header de esa migración.

Conclusión: hoy el CRM **no diferencia una carga de SANCOR de una de PREMEDIC**, aunque
el motor para hacerlo esté listo.

### 2.2 El caso TELLERIA lo prueba

Alta `3df0b2b3`, estado **`enviada`**:

| Campo | Valor en el CRM | Valor real (Drive) |
|---|---|---|
| tipo_alta | `NULL` | DESREGULADO |
| plan_codigo | `NULL` | GA1525 |
| cantidad_capitas | `NULL` | 1 |
| cuota | `NULL` | $25.125,25 |
| aportes_promedio | `NULL` | $42.445,23 |
| sueldo_bruto | `NULL` | $1.414.841,00 |
| periodo_aportes | `NULL` | JUNIO 2026 |
| carpeta Drive | ✗ | carpeta manual en Drive del asesor |
| resumen generado | ✗ | `info alta.txt` escrito a mano |
| ítems del checklist | 0 de 8 completados | 6 archivos en la carpeta |
| integrantes cargados | 0 | 1 titular con 9 datos |

El trámite existió **entero fuera del CRM**. El CRM guarda el cascarón; el expediente
vive en WhatsApp + Drive. Y aun así el alta pudo pasar a `enviada`.

### 2.3 No hay vínculo alta ↔ cotización

`altas` **no tiene `cotizacion_id`**. La cotización aprobada del lead
(`f0c878bb`, sancor, integrantes `[{rol:titular, edad:25}]`) y el alta son dos objetos
sueltos colgados del mismo lead. `iniciarAlta()` no lee la cotización: no arrastra plan,
ni cuota, ni cantidad de integrantes, ni edades. El asesor re-tipea todo.

### 2.4 Bug de datos en la cotización (mirar antes de liquidar nada)

```
lead_cotizaciones.valor_final     = -1705
leads.valor_final_socio           = -1705
leads.valor_forecast              = -1705
```

El PDF de Sancor dice: SUBTOTAL **$-1.705,75** → + Cuota Social $26.831,00 →
**TOTAL A PAGAR $25.125,25**. Se guardó el subtotal como valor final. Un número
**negativo** pasó la validación y se propagó al lead y al forecast. Cualquier comisión
calculada sobre `cuota`/`valor_final` con este dato sale mal.

### 2.5 El vocabulario del CRM no es el del negocio

`tipo_alta` es un enum cerrado de cuatro: `particular | relacion_dependencia |
monotributo | pmo`. El caso real es **DESREGULADO** (opción de cambio de obra social,
Decreto 171/2024, con aportes redireccionados). No está en la lista. Cada asesor lo va a
mapear a lo que le parezca — y `tipo_alta` es exactamente el campo que **define la escala
comisional** (`generarComisionParaAlta(segmento: tipo_alta)`).

Efecto colateral hoy: como esta alta tiene `tipo_alta = NULL`, si un admin la aprueba
**no se genera comisión** — cae en el guard de `prepaga-actions.ts:823` y solo deja una
actividad `comision_sin_regla`. El freno funciona, pero el dato de origen está mal.

### 2.6 El prefill del titular es mínimo

`iniciarAlta()` copia al titular solo `nombre, cuil, telefono`. El lead ya trae `dni`,
`email`, `edades`, `cuit_empleador`, `address_city`, `address_state`; `alta_integrantes`
tiene columnas para casi todo eso y quedan vacías. En este caso el lead tiene DNI pero
**no CUIL** — el CUIL está en el DNI dorso y en el recibo, y nadie lo subió al CRM.

### 2.7 "Enviar a procesar" no existe como acto

`enviada` es una opción más de un `<select>` (`CambiarEstadoAlta.tsx`). No hay:

- validación de completitud (documentos requeridos, datos requeridos, integrantes),
- armado del paquete (resumen + links de Drive) como entregable,
- bandeja del admin de "altas para procesar" con lo que falta a la vista.

Por eso el alta de TELLERIA está `enviada` con 0/8 documentos.

---

## 3. Lo que SANCOR desregulado exige realmente

Extraído del expediente completo en Drive (6 archivos):

**Comerciales** — plan **GA1525** (ojo: el PDF de cotización dice "SANCOR 1000 B", que es
el nombre comercial; el código del alta es otro), condición DESREGULADOS, 1 cápita,
cuota $25.125,25, aportes promedio $42.445,23 sobre sueldo bruto $1.414.841,00, período JUNIO.

**Titular** — nombre, DNI, CUIL, edad, **peso (90 kg)**, **altura (1,86 m)**, domicilio con
CP, teléfono, email. Peso y altura son requisito de la DDJJ de salud de Sancor: no existen
en `leads`, sí en `alta_integrantes`.

**Específicos de desregulado — hoy sin campo en el modelo:**

| Dato | Valor del caso | Dónde iría |
|---|---|---|
| N° de formulario de opción | 360617931 | `alta_items` seccion=datos |
| Fecha inicio de vigencia | 01/09/2026 | seccion=datos (tipo fecha) |
| Obra social origen | 126205 – OSECAC | seccion=datos |
| Obra social destino | 902108 – Mutual Sancor Salud | seccion=datos |
| CUIT empleador | 30-70933260-7 | ya existe en `leads.cuit_empleador` (vacío) |
| CP / Provincia / Localidad | 1437 / CABA / MOM(2001-3900) | `leads.address_*` (vacíos) |

**Documentos del expediente real** — DNI frente, DNI dorso, recibo de sueldo, PDF de
cotización, constancia de opción de cambio (PDF de la SSSalud), tarjeta (medio de pago).

Contra el checklist genérico actual:

- pide "DNI frente y dorso" como **un** ítem → en el expediente son **dos archivos**;
- "Recibo de sueldo" figura **no requerido** → en un desregulado es el documento que
  justifica los aportes, es el más requerido de todos;
- no pide la **constancia de opción** con ese nombre (tiene "Solicitud de opción");
- no pide **tarjeta / medio de pago**, y `altas.medio_pago` existe y está vacío.

---

## 4. Trade-off de seguridad que sigue abierto (y ahora pesa más)

`altas_update` (RLS) deja al asesor dueño actualizar **cualquier** columna, `estado`
incluido. La regla "solo admin aprueba/rechaza" vive **solo** en `actualizarEstadoAlta()`.
Ya está señalado en `ANALISIS_TRAZABILIDAD_PREPAGAS.md §4`.

Lo que cambia con este trabajo: si el gate de completitud para pasar a `enviada` también
vive solo en la server action, se saltea igual con un `update` directo contra la API REST.
**Si vamos a hacer que "enviada" signifique algo, la validación tiene que apoyarse en la
base**, no solo en la action.

---

## 5. Plan propuesto (en orden, del más barato al más caro)

**Paso 1 — Configuración, sin código.** Crear la plantilla real
`SANCOR SALUD · desregulado` con sus ítems `documentos` y `datos`, y su
`resumen_template` que reproduzca el formato de `info alta.txt`. Todo esto ya es
soportado: plantilla por `(prepaga_id, tipo_alta)` con fallback genérico. Piloto de una
prepaga × una condición para validar el flujo antes de replicar a las otras nueve.

**Paso 2 — Conectar cotización → alta.** `altas.cotizacion_id` + prefill en
`iniciarAlta()`: plan, cuota, cápitas, integrantes con edades desde `lead_cotizaciones`;
dni, email, domicilio, cuit_empleador desde `leads`. *Por qué:* es el punto donde el
asesor hoy re-tipea y donde se pierde la trazabilidad de "de qué cotización salió esta venta".

**Paso 3 — Arreglar el valor final de la cotización.** Validar que `valor_final > 0` y
revisar el mapeo del cotizador externo de Sancor (subtotal ≠ total). *Por qué:* alimenta
forecast y comisión.

**Paso 4 — "Enviar a procesar" como acto.** Función de validación de completitud
(documentos requeridos + datos requeridos + al menos un integrante con DNI/CUIL) que
gatea el pasaje a `enviada`, más bandeja de admin. Con el respaldo en RLS del §4.

**Paso 5 — Trazabilidad fina.** Los tres gaps del documento anterior: `alta_id` en
`activities`, actividad al completar un ítem, `updated_by` en `altas`.

---

## 6. Definiciones que necesito de tu lado

1. **`tipo_alta` y "desregulado".** ¿Es un quinto valor del enum, o "desregulado" es lo
   mismo que ya llamás `relacion_dependencia` / `pmo`? La respuesta cambia las reglas
   comisionales, así que no la decido solo.
2. **Granularidad de la plantilla.** ¿Una plantilla por prepaga, o por
   (prepaga × condición)? SANCOR desregulado y SANCOR particular piden documentación
   distinta — el modelo ya lo soporta, es decisión de cuánto configurar.
3. **Peso, altura y DDJJ.** ¿Son de SANCOR o los piden todas? Define si van a
   `alta_integrantes` (columna fija, ya existe) o a `datos` por plantilla.
4. **Alcance del piloto.** ¿Cerramos el ciclo completo con SANCOR desregulado y recién
   después replicamos, o querés las 10 prepagas configuradas de una?
5. **El caso TELLERIA.** ¿Lo usamos como caso de prueba y le cargamos los datos reales
   para validar el resumen generado contra `info alta.txt`, o lo dejamos como está?

---

# ANEXO — Lo aplicado (2026-08-27)

Decisiones tomadas con la agencia:

| Pregunta | Respuesta |
|---|---|
| ¿"Desregulado" es un tipo_alta nuevo? | No: se mapea a `relacion_dependencia`. Confirmado contra la base — Sancor no tiene regla comisional `pmo`, y en Premedic ese segmento está anotado como "Desregulado superador". |
| Granularidad de plantilla | Por **prepaga × condición**. |
| Peso y altura | Los piden todas → quedan como columnas fijas de `alta_integrantes` (ya existían), no como dato por plantilla. |
| Alcance | Piloto completo con SANCOR desregulado. |
| Caso TELLERIA | Se carga con datos reales y se valida el resumen. |

## Migraciones aplicadas

**`20260827_1_ciclo_alta_piloto.sql`**

- `altas.cotizacion_id` → la venta sabe de qué cotización salió.
- Índice único de plantilla activa por `(prepaga_id, tipo_alta)` (+ uno parcial para la genérica): "una plantilla por prepaga × condición" pasa a ser garantía del modelo. `iniciarAlta()` elegía con `.limit(1)`; con dos activas, cuál ganaba dependía del orden de Postgres.
- `activities.alta_id` → cierra el gap #1 del análisis anterior: los eventos de un trámite ya no se distinguen solo por texto libre.

**`20260827_2_plantilla_sancor_desregulado.sql`**

Primera plantilla real del sistema: 8 documentos + 8 datos + `resumen_template`. Los 6 documentos requeridos son exactamente los del expediente real. DNI frente y dorso van separados porque un ítem = un archivo en Drive: pedirlos juntos hace que el segundo pise al primero.

**`20260827_3_altas_guard_estado.sql`** — trigger `altas_guard_estado`

Mueve dos reglas de negocio de la server action a la base:

1. Aprobar/rechazar solo admin. Cierra el agujero de `altas_update` señalado en `ANALISIS_TRAZABILIDAD_PREPAGAS.md §4`: un asesor podía auto-aprobarse una venta con un `update` directo contra la API REST y generarse la comisión.
2. Enviar a procesar exige el trámite completo (tipo de alta, cuota > 0, ítems requeridos, titular con DNI o CUIL). El admin puede forzar.

**TRADE-OFF, explícito:** el guard se saltea con `auth.uid() IS NULL`, o sea para el `service_role` y las migraciones. Es deliberado — si no, ninguna corrección de datos podría tocar `estado` — y se apoya en que la service_role key nunca llega al cliente. Si mañana una API route pública usa service_role para mover altas, este guard no la cubre.

## Cambios de código

- `iniciarAlta()`: busca la cotización aprobada del lead para esa prepaga (o recibe `cotizacion_id`), arrastra plan, cuota y cantidad de cápitas, crea una fila por integrante de la cotización, y prefillea el titular con DNI, email y domicilio del lead. **La cuota solo se arrastra si es positiva** — el caso Sancor ya demostró que el cotizador externo puede guardar un subtotal negativo.
- `getFaltantesAlta()`: espejo en TypeScript del trigger. Existe para poder *mostrar* la lista antes de que el asesor apriete el botón, en vez de devolverle una excepción de Postgres. La base sigue siendo la que manda.
- `CambiarEstadoAlta`: el botón pasa a decir "Enviar a procesar", se deshabilita si falta algo y lista qué falta.
- `alta-resumen.ts`: tres arreglos que salieron de probar el template contra el caso real —
  1. las claves de `{{datos.*}}` ahora se normalizan con NFD, así "Código postal" produce `codigo_postal` y no `cdigo_postal` (fallaba en silencio);
  2. los ítems de tipo fecha se interpolan dd/mm/aaaa, no `2026-09-01`;
  3. los importes salen siempre con dos decimales, como los escribe la prepaga.
  Además `{{integrantes}}`: el motor no tiene bucles y la cantidad de cápitas es variable.

## Validación

`tsc` limpio con las versiones exactas del lockfile. El resumen generado para TELLERIA se comparó contra `info alta.txt`: coincide salvo por el email (el archivo original está truncado en `IVAN.JR.NT25@GMA`) y por la altura, que el CRM guarda en cm (186 CM) donde el original decía 1.86 MT.

## Pendiente

- Los 6 documentos del expediente están en Drive pero no cargados en el CRM: hay que subirlos desde `/altas/<id>` para poder probar el envío completo.
- Confirmar si DDJJ de salud y solicitud firmada son parte del trámite de Sancor (quedaron como no requeridos).
- Falta el email del titular.
- Replicar la plantilla al resto de prepagas × condiciones una vez validado el piloto.

---

# ANEXO 2 — Checklist en dos momentos (2026-08-27)

Regla que faltaba: **en un desregulado de relación de dependencia, la constancia
de derivación de aportes no se manda con el alta.** Recién cuando el admin
aprueba se adjunta, y con eso el trámite pasa a liquidación.

Es el mismo papel que la plantilla llamaba "Constancia de opción de cambio", y
lo teníamos mal ubicado: estaba como requerido **para enviar**.

## El error de modelo que destapó

El checklist era uno solo y vencía entero en el envío. Con un documento que
todavía no existe al momento de enviar, eso dejaba dos salidas y las dos malas:
pedirlo igual (el trámite nunca se puede enviar) o no pedirlo nunca (se liquida
sin el papel que respalda la plata).

## Cómo se resolvió

`momento` (`envio` | `post_aprobacion`) en `checklist_plantilla_items`, con
snapshot en `alta_items` — mismo criterio que `seccion`: si mañana se cambia la
plantilla, no se le mueve de etapa un documento a un trámite ya en curso.

Se modeló como atributo del ítem y **no** como un estado nuevo del alta: qué
documento vence cuándo depende de la prepaga y la condición, que es justo lo que
la plantilla ya discrimina. Un estado nuevo habría hecho falta replicarlo en la
UI, en las transiciones y en el guard, para expresar lo mismo.

Son dos cortes independientes sobre el mismo checklist:

| | `seccion` | `momento` |
|---|---|---|
| responde | qué tipo de cosa es | cuándo vence |
| valores | `documentos` / `datos` | `envio` / `post_aprobacion` |

## Decisiones de la agencia y cómo quedaron

| Decisión | Implementación |
|---|---|
| La comisión **no se genera** hasta la constancia | Aprobar deja de devengar si hay ítems post-aprobación pendientes: registra una actividad `comision_pendiente_documentacion` y espera |
| La constancia la adjunta **cualquiera de los dos** | El ítem no tiene restricción de rol: sigue la RLS de `alta_items` |
| El pase a liquidación **lo confirma el admin** | Nueva action `pasarALiquidacion()`, solo admin. Adjuntar habilita el botón; no lo dispara |

Por qué el pase es del admin aunque adjuntar no lo sea: si liquidar se
disparara solo al subir el archivo, el asesor decidiría cuándo se le devenga la
comisión.

## Respaldo en la base

- El gate de envío ahora cuenta solo ítems `momento = 'envio'`.
- Trigger nuevo `comisiones_guard_post_aprobacion` (BEFORE INSERT en
  `comisiones`): no hay comisión si el alta tiene documentación post-aprobación
  requerida pendiente. Mismo criterio que el guard de estado — la regla vive en
  la base y no solo en `pasarALiquidacion()`, para que la plata no se devengue
  sin el papel aunque mañana aparezca otro código que inserte comisiones.
- **Mismo trade-off de siempre:** ambos triggers se saltean con
  `auth.uid() IS NULL` (service_role y migraciones).

Detalle no obvio: `generarComisionParaAlta()` no lanza excepción cuando falta la
regla comisional — deja una actividad y vuelve sin insertar. `pasarALiquidacion()`
verifica después si la comisión existe de verdad, porque si no el admin vería
"pasó a liquidación" con cero comisiones generadas.

## Estado del caso piloto

Alta TELLERIA: 5 documentos requeridos pendientes para enviar (los datos ya
están completos) y 1 post-aprobación, la constancia de derivación de aportes.

## Sin verificar

Los `RAISE EXCEPTION` de los dos triggers no se pudieron ejercitar: el MCP se
conecta con service_role, que es justamente el caso que los saltea. La lógica
está, pero el rechazo real hay que probarlo desde la app con un usuario asesor.
