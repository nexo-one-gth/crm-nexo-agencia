# Dónde viven los archivos de un alta

Fecha: 2026-08-27 · Decisión pendiente. Diagnóstico + opciones, sin implementar.

---

## 1. Qué hace el sistema hoy

`iniciarAlta()` llama a `crearCarpetaDrive(prepagas.drive_folder_id, "Apellido Nombre - AAAA-MM-DD")`.
O sea: **la carpeta del trámite se crea como hija directa de la carpeta de la prepaga.**

El árbol real de Drive:

```
nexo salud (My Drive de nexo.onedigital@gmail.com)
├── 1-NEXO-SALUD
│   ├── manuales crm, logos, condiciones comerciales…
│   └── altas                          ← creada A MANO el 2026-08-27
│       └── TELLERIA CLOSSA NAZARENO IVAN   ← el expediente, cargado a mano
└── 2-PREPAGAS
    ├── SANCOR SALUD                   ← prepagas.drive_folder_id
    │   ├── CARTILLA, COPAGOS, FORMULARIOS, ZONAS HABILITADAS,
    │   │   REINTEGROS, BENEFICIOS POR PLAN… (20 carpetas de material)
    │   └── (acá caerían los trámites)  ← lo que hace el código
    ├── AVALIAN, MEDIFE, OMINT, PREMEDIC…
```

Hay **dos estructuras compitiendo**: la que usa el código (bajo la prepaga) y la
que la agencia armó a mano (`1-NEXO-SALUD/altas/`). La segunda es la intuición
correcta; la primera es la implementada.

---

## 2. Cuatro problemas concretos

### 2.1 Los trámites se mezclan con el material comercial

`getRecursosPrepaga()` lista los hijos de `prepagas.drive_folder_id` y los
muestra en `/prepagas/[slug]`. Cada alta nueva aparece ahí, al lado de CARTILLA
y FORMULARIOS. Con 50 altas por mes el navegador de recursos deja de servir.

### 2.2 Fuga de datos entre asesores — el problema serio

Los permisos de Drive no saben nada del RLS. **Quien tenga acceso a la carpeta de
la prepaga ve los trámites de todos los asesores**: DNIs, recibos de sueldo,
CBUs, datos de salud. El CRM aísla por asesor y por equipo; Drive no.

Es la clase de agujero que la arquitectura del CRM está diseñada para evitar, y
que se abre por afuera de ella.

### 2.3 La subida a Drive nunca se ejerció, y hay razón para dudar de que funcione

```
alta_items con drive_file_id  →  0 de 68
alta_items con archivo_path   →  1 de 68
```

Nunca se subió un archivo a Drive desde el CRM. Hay carpetas creadas, pero
ningún archivo adentro.

La hipótesis: **una service account sin licencia de Workspace no tiene cuota de
almacenamiento propia.** Puede crear carpetas (ocupan 0 bytes) pero al crear un
archivo falla con `storageQuotaExceeded`, porque el archivo quedaría a nombre de
la service account. Eso encaja exactamente con lo que muestran los datos:
carpetas sí, archivos no.

La nota de la migración `20260804_alta_carpeta_drive_integrantes.sql` ya lo
anticipaba: *"Debe vivir en una Unidad Compartida para que el service account
pueda escribir"*. Pero las Unidades Compartidas requieren Google Workspace, y
este árbol cuelga de una cuenta Gmail común.

**SIN CONFIRMAR.** No pude ejecutar la prueba: el shell del bridge no tiene
salida a `googleapis.com`. Para confirmarlo en 30 segundos: entrar a un alta con
carpeta creada (por ejemplo la de Premedic) y subir cualquier archivo desde el
checklist. Si aparece "No se pudo subir el archivo a Drive", el log de Vercel va
a tener el `storageQuotaExceeded`.

### 2.4 Dos caminos de subida en el código

| Función | Destino | Columna | ¿La usa la UI? |
|---|---|---|---|
| `subirAdjunto()` | Supabase Storage | `archivo_path` | **No, nadie** |
| `subirAdjuntoDrive()` | Google Drive | `drive_file_id` | Sí, `ChecklistInteractivo` |

Dos fuentes de verdad para "dónde está el archivo", una de ellas muerta pero con
una fila de datos usándola. Es la misma clase de problema que `CLAUDE.md` marca
como recurrente en este proyecto.

---

## 3. Las opciones

### A. Drive con Unidad Compartida (requiere Workspace)

Migrar el árbol a una Unidad Compartida. Los archivos los posee la unidad, no la
service account: se resuelve la cuota. Y las Unidades Compartidas permiten
permisos por carpeta.

- **A favor:** es lo que el código ya asume. La agencia ya vive en Drive.
- **En contra:** cuesta plata (Workspace, ~USD 7/usuario/mes). Y **no resuelve
  2.2**: seguiría sin haber forma de que Drive respete "asesor ve lo suyo, líder
  ve su equipo" sin administrar permisos carpeta por carpeta a mano.

### B. Supabase Storage para los trámites, Drive solo para material comercial

Los documentos del alta van a un bucket privado con RLS. Drive queda para lo que
es hoy: material que se comparte con humanos.

- **A favor:** el aislamiento por rol lo resuelve **el mismo RLS que ya define
  quién ve qué**. Una sola fuente de verdad. Sin costo extra. La función
  `subirAdjunto()` ya existe (habría que revisarla, no escribirla).
- **En contra:** el admin pierde la comodidad de mandarle a la prepaga un link
  de carpeta. Habría que resolver ese paso.

### C. Híbrido — Storage como origen, Drive como salida

Storage es el sistema de registro. Cuando el admin envía el trámite a la
prepaga, se exporta el paquete (documentos + resumen) a una carpeta de Drive
creada para eso.

- **A favor:** el dato sensible vive donde el RLS lo protege, y el link para la
  prepaga existe cuando hace falta. La exportación es también el momento natural
  para armar "el paquete que se manda".
- **En contra:** más piezas. Y la copia en Drive puede quedar desactualizada
  respecto del original si alguien reemplaza un documento después.

---

## 4. Recomendación

**B, con la puerta abierta a C.**

El motivo es 2.2: en un CRM de comisiones, el aislamiento entre asesores es la
propiedad crítica, y Drive no la puede expresar. Poner los trámites en Storage
hace que la respuesta a "¿quién puede ver el recibo de sueldo de este socio?"
sea la misma política que ya responde "¿quién puede ver esta venta?" — una sola
regla, en un solo lugar.

La opción A resuelve un problema técnico (la cuota) y deja abierto el de
permisos, además de costar plata.

La exportación a Drive (C) se puede agregar después, cuando el flujo de envío al
admin esté rodado y sepamos qué necesita mandar de verdad.

---

## 5. Si se va por Drive igual: cómo debería quedar el árbol

No colgar los trámites de la carpeta de la prepaga. Una raíz aparte:

```
nexo salud
├── 2-PREPAGAS/          ← material comercial (como está)
└── 3-ALTAS/             ← trámites
    └── 2026-08/
        └── SANCOR SALUD/
            └── TELLERIA CLOSSA NAZARENO IVAN - 43268808 - 3df0b2b3/
```

Tres decisiones del nombre de carpeta, contra el actual `Apellido Nombre - fecha`:

- **partición por mes** antes que por prepaga: las carpetas de Drive se vuelven
  lentas y difíciles de mirar pasadas unas cientos de entradas;
- **DNI en el nombre**: dos socios se pueden llamar igual;
- **id corto del alta**: un mismo socio puede tener dos trámites (un rechazo y
  un reintento con otra prepaga), y sin esto las dos carpetas colisionan.

Haría falta `prepagas.drive_folder_altas_id` (o una raíz única de altas en env)
separada de `drive_folder_id`, que hoy se usa para las dos cosas.

---

## 6. Sobre "sincronizar"

**La respuesta correcta es que no haga falta.** Sincronizar dos lugares implica
decidir cuál gana cuando difieren, y eso es una fuente de bugs permanente.

El riesgo real: un asesor sube un archivo a la carpeta de Drive por afuera del
CRM. El CRM no se entera, el ítem del checklist sigue incompleto, y el trámite no
se puede enviar aunque el papel esté. Se puede escribir un reconciliador que
liste la carpeta y matchee por nombre de archivo contra las etiquetas del
checklist, pero es frágil: depende de que nadie renombre nada.

La alternativa sana es **una sola puerta**: los documentos del trámite entran por
el CRM. Si alguien los tiene en Drive, los sube desde el CRM. Lo que el CRM
escriba en Drive es salida, no entrada.

---

## 7. Aparte: por qué el alta de TELLERIA no tiene carpeta

El alta se creó el 2026-08-04 y la funcionalidad de carpeta por trámite se
aplicó el 2026-08-08. Es anterior, nada más. Se puede crear desde el banner del
detalle del alta — pero conviene decidir primero adónde debería apuntar.

---

## 8. Lo que hay que decidir

1. ¿Hay o va a haber Google Workspace en la agencia? Eso habilita o descarta la
   opción A.
2. ¿Cómo le manda hoy el admin la documentación a la prepaga? (mail, WhatsApp,
   portal de la prepaga, link de Drive). Define si hace falta la salida a Drive.
3. ¿Los asesores tienen que poder ver los trámites de otros asesores? Asumo que
   no, pero es la pregunta que decide todo lo demás.

---

# DECISIÓN (2026-08-27) — Drive con unidad compartida, invisible para el asesor

La agencia **sí tiene Google Workspace**, así que la opción A queda habilitada. Y
la definición de negocio resuelve el problema de permisos de 2.2 sin tener que
replicar el RLS en Drive: **el asesor no accede a Drive**. Sube por el CRM y
listo. Solo los admins son miembros de la unidad.

## Estructura

```
Unidad Compartida (GOOGLE_DRIVE_ALTAS_ROOT_ID)
└── 2026-08/
    └── SANCOR SALUD/
        └── TELLERIA CLOSSA NAZARENO IVAN - 43268808 - 3df0b2b3/
```

Mes arriba (cada carpeta se mantiene chica), DNI (dos socios se pueden llamar
igual) e id corto del alta (un socio puede tener un rechazo y un reintento).

Fuera de `GOOGLE_DRIVE_ROOT_FOLDER_ID`, que es la raíz contra la que
`esDescendienteDeAlguna()` autoriza el navegador de `/recursos`. Al quedar
afuera, un asesor no puede llegar a la documentación de las altas ni pasando el
id de carpeta a mano.

## Setup manual en Workspace (no se puede hacer desde el CRM)

1. Crear la unidad compartida, separada del árbol `nexo salud`.
2. Agregar la service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) como
   **Administrador de contenido**.
3. Agregar a los admins como miembros. **A los asesores no.**
4. `GOOGLE_DRIVE_ALTAS_ROOT_ID=<id>` en el env de Vercel y en `.env.local`.

Sin esa variable el alta se crea igual, solo que sin carpeta, y
`crearCarpetaAlta()` devuelve un error que lo dice.

## Qué cambió en el código

- `asegurarRutaCarpetas(rootId, segmentos)` en `google-drive.ts`: crea la ruta
  anidada reusando `crearCarpetaDrive()`, que es get-or-create.
- `iniciarAlta()` y `crearCarpetaAlta()` cuelgan de la raíz de altas, no de
  `prepagas.drive_folder_id`.
- **`obtenerMetadataArchivo()` no pasaba `supportsAllDrives`.** Un archivo en una
  unidad compartida devuelve 404 sin eso. Estaba latente porque nunca se había
  subido un archivo.
- El link "Ver en Drive" del checklist y el banner de carpeta pasan a ser solo de
  admin. Al asesor le darían un 403 de Google.
- `GET /api/altas/[id]/paquete`: ZIP con la documentación y el resumen, para
  adjuntar al mail o al WhatsApp. Solo admin.

## Detalles del paquete que no son obvios

- **El resumen se regenera**, no se lee de `altas.resumen_texto`. Ese campo es un
  cache de la última vez que alguien apretó "Generar": si después se corrigió un
  dato, el paquete saldría con el texto viejo.
- **Los faltantes van adentro del ZIP** (`_FALTANTES.txt`), no como error. El
  admin muchas veces necesita mandar lo que hay; mejor que sepa qué le falta a
  que crea que está completo.
- **Los nombres de archivo van sin acentos.** JSZip no marca las entradas como
  UTF-8 y "Constancia de derivación" se abre como "derivaciÃ³n" en el
  Explorador de Windows.
- Se agregó `jszip` como dependencia (con el lockfile actualizado, para que
  `npm ci` de Vercel no falle).

## Sin probar

Nada de esto se ejecutó contra Drive: el shell del bridge no tiene salida a
`googleapis.com`. La generación del ZIP sí se verificó por separado (archivo
válido, se abre). Lo que hay que probar en cuanto esté la unidad compartida:

1. Iniciar un alta → que cree `2026-08/PREPAGA/Socio - DNI - id`.
2. Subir un documento → que **no** falle con `storageQuotaExceeded`. Este es el
   punto que motivó todo: en un My Drive fallaba; en una unidad compartida no
   debería.
3. Descargar el paquete y abrirlo en Windows.
