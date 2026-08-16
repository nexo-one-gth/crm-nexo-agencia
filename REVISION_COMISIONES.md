# Revisión del módulo de comisiones — agenda

**Fecha:** 2026-08-08 · **revisado contra la base el 2026-08-16**
**Fuente:** `Condiciones-Comerciales-Prepagas-NEXO-Salud.pdf` + estado real de la base
**Estado:** herramientas construidas; faltan los números reales

> ### Medición del 2026-08-16 — los conteos de abajo quedaron viejos
>
> | | Este documento (8-ago) | Medido (16-ago) |
> |---|---|---|
> | Reglas de prepaga | 20, todas en 100 | **23**: 21 en 100 y 2 reales (PMO) |
> | Asignaciones asesor↔prepaga | 17 — 10 con pct, **7 NULL** | 29 — 12 con pct, **17 NULL** |
> | Prepagas activas sin reglas | 4 | 4, las mismas |
>
> Los bloqueos pasaron de 7 a 17: se siguieron asignando asesores a prepagas sin
> cargarles el porcentaje. Ya no hace falta consultar la base para verlos —
> `/admin/comisiones/bloqueos` los muestra en vivo, y los recuenta solo.
>
> Lo único cargado de verdad son las dos reglas PMO (DOCTOR RED 7,038% y
> PREMEDIC 7,65%, ambas sobre sueldo bruto). Además **DOCTOR RED y SALUD CENTRAL
> tienen reglas pero están desactivadas** en el catálogo: el problema inverso al
> de las 4 activas sin reglas.
>
> La única comisión existente ilustra el punto 1 completo: AVALIAN particular,
> base $50.000, prepaga al 100% → factura $50.000, paga $50.000, **margen 0**, y
> ya está liquidada. Tiene `comision_pct_asesor` en NULL, o sea que se generó
> antes de que existiera la guarda; es un registro del comportamiento viejo.

---

## El modelo de cálculo (definido 2026-08-08)

**Todos los porcentajes están en la misma unidad: % de la cuota.** Son escalas independientes que se restan; ninguna se multiplica por otra.

```
facturación NEXO   =  cuota × prepaga_comision_reglas.porcentaje    260% → 130.000
pago al asesor     =  cuota × prepaga_asesores.comision_pct         180% →  90.000
override del líder =  cuota × supervisor_overrides.pct_equipo
─────────────────────────────────────────────────────────────────────────────────
margen NEXO        =  facturación − suma de todos los pagos de esa venta
```

La prepaga le paga al broker un múltiplo de la cuota —260%, 200%, 180% según prepaga y condición— y de ahí sale lo que cobra el asesor. **El PDF de condiciones dice "100%" en todos los casos: ese documento no refleja los valores reales que se negocian.** Los carga a mano el administrador en `/admin/comisiones/reglas`.

> La versión original del generador **multiplicaba** el porcentaje de la prepaga por el del asesor. Eso solo tiene sentido si el segundo es una porción del primero; con ambos sobre la cuota daba absurdos (50.000 × 2,6 × 1,8 = 234.000). Corregido.

**La facturación no se guarda como campo aparte:** la fila `directa` de cada venta ya lleva `monto_base` y `porcentaje` (el de la prepaga), así que sale de ahí. El margen por venta es esa facturación menos la suma de todas las filas de comisión de esa alta.

---

## 1. 🔴 Faltan cargar los porcentajes reales

```
20 reglas de prepaga        → todas en 100    (deberían ser 260 / 200 / 180…)
17 asignaciones asesor↔prepaga
  10 con comision_pct       → todas en 100
   7 en NULL
```

Ninguno de estos números es real. Con el modelo nuevo, un 100 en la regla de la prepaga significa que NEXO factura exactamente la cuota, y un 100 en el asesor significa que se lleva todo: **margen cero**.

**Cambio de comportamiento aplicado:** si el asesor no tiene porcentaje cargado, ya **no se genera** la comisión — queda una actividad en el lead explicando por qué. Antes el `NULL` se trataba como "×1" y liquidaba el total en silencio. Esto significa que las 7 asignaciones sin porcentaje van a frenar aprobaciones hasta que se completen.

---

## 2. 🔴 Cuatro prepagas activas sin reglas comisionales

`OMINT`, `HOMINIS`, `GALENO` y `SWISS MEDICAL` están activas en el catálogo y **sin ninguna regla**. Si se aprueba un alta de esas, no se genera comisión: solo queda una actividad en el lead.

Además no figuran en el PDF de condiciones comerciales. O se cargan las condiciones, o se desactivan.

---

## 3. La escala por origen del dato

`leads.origen` funciona y se setea solo:

| Origen | Cómo nace | Volumen hoy |
|---|---|---|
| `nexo` | importación sin campaña | 4.918 |
| `referido` | lo carga el asesor | 6 |
| `campania` | importación con campaña | 0 |

`prepaga_comision_reglas` ya tiene columna `origen`, y el generador busca la regla específica antes de caer a la general. **Pero las 20 reglas tienen `origen = NULL`**, así que hoy un referido cobra lo mismo que un lead de Nexo.

**El problema de modelado:** la dimensión `origen` está en la tabla equivocada. La prepaga paga 100% sin importar de dónde salió el lead — no lo sabe ni le importa. Lo que tiene sentido que cambie es **la parte del asesor**: si la agencia pagó la publicidad se lleva menos, si trajo el dato se lleva más.

Y `prepaga_asesores` no tiene dimensión `origen`: es un único `comision_pct` por asesor y prepaga.

**Decisión tomada:** los porcentajes los carga a mano el administrador y no son iguales para todos. Falta que la agencia defina los números; recién ahí se agrega la dimensión. La forma sugerida es una tabla con la misma estructura que `prepaga_comision_reglas` —`origen NULL` = default, valor específico = excepción—, para que la lógica de fallback sea idéntica a la que ya existe.

---

## 4. ✅ Base del override — resuelto

Es % de la cuota, como todo el resto. Ver el modelo de cálculo arriba.

---

## 4bis. ✅ Módulo de facturación y margen — construido (2026-08-16)

En `/admin/comisiones/margen`, agrupable por prepaga, mes, asesor o equipo. Marca en rojo las ventas de margen negativo y las que solo tienen override —sin fila `directa` no hay porcentaje de prepaga, así que su facturación no se puede calcular y se señala en vez de mostrarse como cero—. Sin cambios de schema, como estaba previsto.

La fórmula, que sigue valiendo:

```sql
-- por alta
facturacion = (SELECT monto_base * porcentaje / 100
                 FROM comisiones WHERE alta_id = X AND tipo = 'directa')
pagos       = (SELECT sum(monto_comision) FROM comisiones WHERE alta_id = X)
margen      = facturacion - pagos
```

Agrupable por prepaga, mes, asesor o equipo. **No requiere cambios de schema.**

Un detalle a definir: qué hacer con las ventas cuyo margen sea negativo —si el asesor más el líder superan lo que paga la prepaga—. Hoy nada lo impide, y es un error de carga probable.

---

## 5. Lo que el PDF exige y el modelo no contempla

### Decomisión
El documento fija permanencia mínima por prepaga, y el importe se descuenta de liquidaciones futuras:

| Prepaga | Decomisión |
|---|---|
| AVALIAN | obligatorio: no aplica · voluntario: 6 meses |
| SANCOR SALUD | 3 meses, todos los segmentos |
| MEDIFÉ | 3 meses |
| PREMEDIC | desregulados y directos: 4 meses |
| DOCTOR RED | PMO: solo por falseamiento de datos · superadores: 6 meses |
| PREVENCIÓN SALUD | 6 meses |
| SALUD CENTRAL | 3 cuotas |

**No hay nada en el schema.** Requiere: fecha de vigencia del socio, seguimiento de bajas y mora, y comisiones negativas o un mecanismo de descuento contra liquidaciones futuras.

### Comisión en cuotas
SALUD CENTRAL paga en **3 cuotas**, cada una efectiva con el pago de la factura del socio. El modelo genera **una sola fila** por venta.

### Comisión condicionada al pago del socio
AVALIAN segmento voluntario: la comisión se hace efectiva **solo con la factura paga**. Hoy la comisión se genera al aprobar el alta, sin esperar nada.

### Ámbito geográfico
Cada prepaga tiene zona habilitada (SANCOR solo AMBA, MEDIFÉ una lista larga, DOCTOR RED nacional). **No se valida en ningún lado.**

### Lotes comisionales con ventana real
El PDF define ventanas concretas —SANCOR lote julio = 25/06 al 23/07, PREVENCIÓN 24/06 al 22/07— y `getOrCreateCierreAbierto` usa el mes calendario para todas.

---

## Orden sugerido para la sesión

1. Los dos 🔴, que afectan plata que se liquida hoy.
2. La base del override (⚠️), antes de cargar cualquier porcentaje.
3. Escalas por origen, cuando existan los números.
4. Decomisión — es lo más grande y probablemente amerite su propio módulo.
5. Cuotas, condicionamiento al pago, ámbito geográfico y ventanas de lote.

---

## Estado al 2026-08-16

Se construyeron las herramientas; **los dos 🔴 siguen abiertos porque son datos, no código**. Los porcentajes reales son números negociados con cada prepaga y no están en el repo ni en la base.

| | Dónde |
|---|---|
| Ver qué frena una liquidación | `/admin/comisiones/bloqueos` |
| Cargar overrides de líder | `/admin/comisiones/overrides` — escritura solo `admin_principal` |
| Facturación, pagos y margen | `/admin/comisiones/margen` |

También se corrigió el tile de comisiones del dashboard, que sumaba por `asesor_id` en vez de `beneficiario_id` y por eso no le mostraba los overrides a ningún líder.

**Lo que sigue bloqueado hasta que existan los números:** los 21 porcentajes en placeholder, las 17 asignaciones sin `comision_pct`, las 4 prepagas activas sin reglas y los 4 líderes sin override. Ninguna venta va a generar comisión correcta antes de eso, y las 6 altas abiertas además necesitan `tipo_alta` y `cuota`.
