# Actualización mensual de tarifas Premedic

Cómo cargar la lista de precios de Premedic cada mes, de forma simple y auditable.

---

## ✅ Instructivo para el equipo (paso a paso)

Cada mes, cuando Premedic publica los precios nuevos:

1. En Drive, dentro de la carpeta madre de tarifarios de Premedic, subí la **carpeta
   del mes** (nombrala tipo "SEPTIEMBRE '26") con los PDFs adentro (DESRE AMBA, DIRE
   AMBA, DESRE INTE, DIRE INTE). El "Plan Simple" no se carga acá.
2. Entrá al CRM → **Admin → Prepagas → botón "Tarifario Premedic"**
   (o directo a `/admin/prepagas/tarifas`). Necesitás rol admin o admin_principal.
3. Elegí la **pestaña del mes** y hacé click en un PDF.
4. Revisá la tabla que aparece: fijate la columna **Var.** (variación vs el mes
   anterior). Si el aumento fue parejo, deberías ver un % similar en casi todas las
   filas. Si ves un valor rarísimo (ej. +180% o -50%) en una fila suelta, algo se
   leyó mal: **no confirmes** y avisá.
5. Si está todo bien, tocá **"Confirmar y activar"**. Repetí para los otros 3 PDFs.
6. Listo: el cotizador ya usa los precios del mes.

**Cosas a tener en cuenta:**
- No podés cargar dos veces el mismo mes para la misma zona/modalidad (la base lo
  bloquea). Si te equivocaste, avisá para revertir.
- Si un PDF no se puede leer (Drive caído, formato raro), usá el botón **"Pegar texto"**:
  abrí el PDF, copiá todo el texto y pegalo; el resto del flujo es igual.
- "Plan Simple" va a aparecer en la lista pero, si lo elegís, te avisa que no es
  cargable acá (es un producto de precio único, fuera de la matriz).

## 🔧 Setup inicial (una sola vez, técnico)

Antes de poder usar la pantalla:

1. `npm install` (instala `pdf-parse`, la librería que lee los PDFs).
2. Compartir la **carpeta madre de Drive** con el email del service account
   (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) con permiso de lectura.
3. (Opcional) Si la carpeta madre cambia, setear `PREMEDIC_TARIFARIO_FOLDER_ID` en
   el `.env.local` con el nuevo ID; por defecto apunta a la carpeta actual.
4. Aplicar la migración `supabase/migrations/20260803_prepaga_tarifas.sql` (ya
   aplicada en el proyecto `agencia`; incluye el índice que evita cargas duplicadas).

## 🧾 Historial de cargas

- **Agosto 2026** — cargado y verificado por MCP (410 filas: AMBA desreg 110 /
  AMBA dir 118 / INT desreg 88 / INT dir 94). Aumento parejo **+4,0%** vs julio.
  Julio quedó cerrado con `vigencia_hasta = 2026-07-31`.

---

## El modelo (por qué así)

El cotizador interno de Premedic **no lee el PDF en vivo**: calcula contra la tabla
`prepaga_tarifas` en Supabase. Cada fila es una combinación:

```
plan × zona × modalidad × composición × banda de edad → precio
```

El cotizador toma como **vigente** lo que tiene `vigencia_hasta = NULL`. Por eso la
actualización mensual **no pisa nada**: cierra el mes anterior (le pone `vigencia_hasta`)
e inserta el nuevo como lote con `vigencia_desde` = 1° del mes. Así las cotizaciones
viejas siguen siendo auditables con el precio que tenían.

## Dónde viven los PDFs

Carpeta madre en Drive (`PREMEDIC_TARIFARIO_FOLDER_ID`, hoy `133D4Ue...`) → una
**subcarpeta por mes** (ej. "AGOSTO '26") → los PDFs adentro. La carpeta madre
**debe estar compartida con el service account** (`GOOGLE_SERVICE_ACCOUNT_EMAIL`)
para que el CRM la lea.

## Qué archivos hay cada mes

Premedic publica **4 listas cargables** (zona × modalidad), más un "Plan Simple":

| Archivo (título real)   | zona | modalidad | filas | soportado |
|-------------------------|------|-----------|-------|-----------|
| DESRE AMBA              | amba | desregulado | 110 | ✅ |
| DIRE AMBA               | amba | directo     | 118 | ✅ |
| DESRE INTE              | interior | desregulado | 88 | ✅ |
| DIRE INTE               | interior | directo     | 94 | ✅ |
| PLAN SIMPLE             | —    | —         | 1 precio | ❌ (producto aparte, fuera de la matriz) |

> Interior no tiene Plan C-100 (por eso menos filas). "Directo" trae además los
> recargos 60-64 (`recargo_60_64_1/2`), en un bloque transpuesto (planes como
> columnas) que el parser reconoce. "Plan Simple" es un precio único: el parser
> lo detecta y lo rechaza con un mensaje claro.

El parser tolera las 3 variantes de encabezado que usa Premedic
("Vigencia … AMBA - Desregulados", "Nomina Directos AMBA - Vigencia …", y el
header al final de la hoja en Interior desregulado). Validado: 110/118/88/94 filas, 0 warnings.

## El parser: `parseTarifarioPremedic(text)`

`parseTarifarioPremedic.ts` recibe el **texto** ya extraído del PDF y devuelve las
filas normalizadas + una lista de `warnings`. No hace I/O, así que es testeable sin PDF.

- Detecta solo la cabecera `Vigencia <mes> <año> <zona> - <modalidad>` para saber
  a qué zona/modalidad/vigencia pertenece la hoja.
- Mapea las etiquetas del PDF a las composiciones de la app
  (`Individual` → `individual`, `Matrimonio + 1 Hijo` → `matrimonio_1hijo`,
  `Adicional Menor de 1 año` → `adicional_menor1`, etc.).
- Valida que cada fila "por banda" tenga sus 4 precios; si falta algo lo reporta en `warnings`.

Validado contra "DESRE AMBA" (Agosto 2026): **110 filas, 0 warnings**. El aumento
junio→agosto resultó **4,0% parejo** en toda la grilla (útil como control cruzado).

## De dónde sale el `text` (extracción)

Recomendado: **reusar la integración de Google Drive que ya tiene el CRM**. Los PDFs de
Premedic ya viven en la carpeta de Drive de la prepaga. El flujo in-app:

```
1. Admin entra a /admin/prepagas/premedic/tarifas
2. Elige el PDF del mes desde la carpeta de Drive de Premedic (navegador ya existente)
3. El server lee su texto (Drive API) y llama parseTarifarioPremedic(text)
4. Se muestra la grilla extraída para REVISIÓN (con el % de variación vs mes anterior)
5. Admin confirma → server action:
     a) UPDATE prepaga_tarifas SET vigencia_hasta = <fin de mes anterior>
        WHERE prepaga_id=... AND zona=... AND modalidad=... AND vigencia_hasta IS NULL
     b) INSERT de las filas nuevas (resolviendo plan_nombre → plan_id contra prepaga_planes)
        con vigencia_desde = 1° del mes, vigencia_hasta = NULL
```

Alternativa si extraer texto del PDF diera problemas de layout: Premedic genera estas
listas **desde un Excel** ("Nominas ... .xlsx"). Si conseguís el `.xlsx`, la lib `xlsx`
que ya está en el stack lo lee sin ambigüedad — más robusto que cualquier PDF.

## Atajo "aplicar +X%"

Como el ajuste suele ser un porcentaje parejo (agosto fue +4,0%), conviene ofrecer también
un botón "clonar mes anterior +X%": toma las filas vigentes, multiplica por (1+X/100),
redondea y arma el lote nuevo. Evita depender del PDF cuando el aumento es lineal.

## Server action de carga (esqueleto)

```ts
// src/app/actions/premedic-tarifas.ts  (a implementar)
'use server'
import { assertAdmin } from '@/lib/supabase/assert-admin'
import { createClient } from '@/lib/supabase/server'
import { parseTarifarioPremedic, type TarifaRow } from '@/lib/premedic/parseTarifarioPremedic'

const PREMEDIC_ID = '4ebf732d-4af2-45f9-9b93-651c3db71a8c'

export async function previsualizarTarifario(text: string) {
  const guard = await assertAdmin(); if (guard.error) return { error: guard.error }
  return { data: parseTarifarioPremedic(text) } // -> se muestra para revisión
}

export async function confirmarTarifario(rows: TarifaRow[], finMesAnterior: string) {
  const guard = await assertAdmin(); if (guard.error) return { error: guard.error }
  const supabase = await createClient()
  const { zona, modalidad, vigencia_desde } = rows[0]

  // 1) resolver plan_nombre -> plan_id
  const { data: planes } = await supabase
    .from('prepaga_planes').select('id, nombre').eq('prepaga_id', PREMEDIC_ID)
  const planId = (n: string) => planes?.find(p => p.nombre === n)?.id

  // 2) cerrar el lote vigente de esa zona/modalidad
  await supabase.from('prepaga_tarifas')
    .update({ vigencia_hasta: finMesAnterior })
    .eq('prepaga_id', PREMEDIC_ID).eq('zona', zona).eq('modalidad', modalidad)
    .is('vigencia_hasta', null)

  // 3) insertar el lote nuevo
  const payload = rows.map(r => ({
    prepaga_id: PREMEDIC_ID, plan_id: planId(r.plan_nombre),
    zona: r.zona, modalidad: r.modalidad, composicion: r.composicion,
    edad_titular_min: r.edad_titular_min, edad_titular_max: r.edad_titular_max,
    precio: r.precio, vigencia_desde: r.vigencia_desde,
  }))
  const { error } = await supabase.from('prepaga_tarifas').insert(payload)
  return error ? { error: error.message } : { success: true, insertadas: payload.length }
}
```

> Nota: `prepaga_tarifas` hoy existe en la base pero **no tiene migración versionada**
> en el repo. Conviene agregar la migración correspondiente para no perder el esquema.
