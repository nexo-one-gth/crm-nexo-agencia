# Revisión del módulo de comisiones — agenda

**Fecha:** 2026-08-08
**Fuente:** `Condiciones-Comerciales-Prepagas-NEXO-Salud.pdf` + estado real de la base
**Estado:** pendiente de sesión de trabajo

---

## Los dos porcentajes, que conviene no mezclar

```
prepaga_comision_reglas.porcentaje   →  lo que la PREPAGA le paga a NEXO
prepaga_asesores.comision_pct        →  lo que de eso se lleva EL ASESOR
```

El generador multiplica: `monto_base × regla.porcentaje × comision_pct_asesor`.

Según el PDF, **todas las prepagas pagan el 100%** del valor comisional. Lo que varía entre ellas es la *base* del cálculo, no el porcentaje.

---

## 1. 🔴 Todos los asesores se llevan el 100%

```
17 asignaciones asesor↔prepaga
  10 con comision_pct cargado → las 10 en 100%
   7 en NULL                  → el generador las trata como 100%
```

En la configuración actual **NEXO no retiene nada**. O es intencional, o son valores de relleno.

El `NULL` es el caso más riesgoso: el panel muestra "Sin comisión definida" pero el generador liquida el total igual. Debería decidirse si `NULL` significa 100% o si debe frenar la generación.

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

## 4. ⚠️ Sobre qué base se calcula el override del líder

Ya marcado en `MODELO_ROLES.md`. El generador asume **porcentaje sobre la comisión de la agencia**:

```
cuota 1000 · regla 10%  →  la agencia gana 100
override del líder 10%  →  $10        (si fuera sobre la cuota: $100)
```

Bloqueante antes de cargar el primer porcentaje en `supervisor_overrides`.

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
