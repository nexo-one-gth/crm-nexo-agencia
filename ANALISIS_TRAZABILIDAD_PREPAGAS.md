# Análisis de trazabilidad — proceso de prepagas

Fecha: 2026-08-22 · Branch: `feat/prepagas-trazabilidad` (desde `main` actualizado)

Este documento mapea cómo funciona hoy el registro de auditoría (quién tocó qué, cuándo, en qué estado) para el tramo lead → cotización → alta con una prepaga → aprobación → comisión. Es la base para decidir, en el próximo paso, qué cambios de modelo de datos hacen falta — todavía no propongo ninguno acá, primero el diagnóstico.

## 1. El mapa del proceso, con lo que dispara cada evento

```
Lead entra/se asigna
        │
        ▼
Cotización (lead_cotizaciones)
        │
        ▼
iniciarAlta()  ────────────────► activities: 'alta_iniciada'          (prepaga-actions.ts:709)
        │                        (queda en el historial del LEAD, no del alta)
        ▼
alta_items se completan          NO genera activity. Solo queda
(checklist de documentos)        completado_by / completado_at en la fila del item.
        │
        ▼
actualizarEstadoAlta()  ───────► activities: 'alta_estado_cambio'      (prepaga-actions.ts:811)
en_proceso→enviada→               "En proceso → Enviada", etc.
observada→aprobada/rechazada
        │
        ▼ (si aprobada)
generarComisionParaAlta()  ────► activities: 'comision_generada'       (prepaga-actions.ts:1110)
                                  o 'comision_sin_regla' si falta       (prepaga-actions.ts:928,943,984,1101)
                                  configuración (regla, sueldo, % asesor)
```

Todo esto corre sobre una sola tabla de auditoría: `public.activities` (`lead_id`, `type`, `description`, `created_by`, `created_at`), definida en `supabase/schema.sql:92`. No es un mecanismo nuevo para prepagas — es el mismo que ya se usa para `lead_created`, `stage_change` y `whatsapp_sent` en `lead-actions.ts`. Reusar el patrón es correcto; el tema es qué tan bien le queda a un proceso que ahora tiene una entidad intermedia (`altas`) que el lead no tenía.

## 2. Lo que está bien (y vale la pena no tocar)

**El log es de solo-agregado para usuarios no-admin.** La policy `activities_insert` (`20260808_modelo_roles_fase_b_politicas.sql:355`) exige `created_by = auth.uid()` — nadie puede insertar una actividad a nombre de otro. Y no existe ninguna policy de `UPDATE`/`DELETE` para asesores o líderes: la única que cubre esos verbos es `activities_admin_write`, `FOR ALL`, solo admin (línea 369). Un asesor puede agregar al historial, pero no puede reescribirlo ni borrarlo. Eso es exactamente la propiedad que querés en un registro de auditoría.

**La visibilidad de `activities` sigue la del lead**, no una lista aparte de roles (línea 345-353): admin ve todo, un líder ve lo de su equipo vía `auth_asesores_visibles()`, un asesor ve lo suyo. Coherente con cómo está resuelto el resto del modelo de permisos.

**El timeline se renderiza**, no es un log que solo vive en la base: `LeadDetailView.tsx:314` itera `activities` y las muestra. Si mañana agregás un evento nuevo, ya tiene dónde aparecer.

## 3. Lo que falta — gaps concretos

**Los eventos de un alta se cuelgan del lead, no del alta.** `activities` no tiene columna `alta_id` (confirmado: ninguna migración le agrega una — grep sobre las 22 migraciones no encuentra `ALTER TABLE ... activities`). Mientras un lead tenga una sola alta esto no se nota. El problema aparece si una alta se rechaza y se inicia una segunda con otra prepaga: los eventos de ambas quedan mezclados en el mismo timeline del lead, distinguibles solo por texto libre en `description` ("Alta: Observada → Rechazada"), sin un campo por el que filtrar "dame el historial de ESTA alta". Para una operación con reintentos de venta (cambio de prepaga tras un rechazo) esto importa.

**Completar un item del checklist no genera actividad.** `alta_items` guarda `completado_by` y `completado_at` (`20260610_modulo_prepagas.sql:272-273`) — sabés quién marcó el último estado de cada documento, pero no queda un evento en el timeline ("Juan subió el DNI"), y si alguien pisa un valor ya cargado, el dato anterior se pierde: no hay historial de versiones del campo, solo el estado actual. Para una checklist de 6-8 documentos por alta, hoy no hay forma de reconstruir en qué orden se completó ni si algo se corrigió después.

**`altas.updated_at` no tiene `updated_by`.** El trigger `altas_updated_at` (`20260610_modulo_prepagas.sql:365`) actualiza la fecha en cada `UPDATE`, pero no registra quién hizo ese update puntual — para saberlo hay que cruzar con el `activities` más cercano en el tiempo, que no siempre existe (por ejemplo, un `crearCarpetaAlta()` que solo actualiza `drive_folder_id` no deja actividad).

## 4. Trade-off de seguridad que corresponde marcar explícitamente

La policy `altas_update` (`20260808_modelo_roles_fase_b_politicas.sql:212-218`) es:

```sql
using (asesor_id = auth.uid() or auth_is_admin())
with check (... and (asesor_id = auth.uid() or auth_is_admin()))
```

Esto le permite al asesor dueño del alta actualizar **cualquier columna**, `estado` incluido, directo contra la tabla. La regla de negocio "solo un admin puede aprobar o rechazar" (`actualizarEstadoAlta()`, `prepaga-actions.ts:785-787`) vive únicamente en la server action, no en la base. Quiere decir que la restricción depende de que todo el código pase por esa función — un `supabase.from('altas').update({estado:'aprobada'})` llamado desde cualquier otro lado (o directo contra la API REST de Supabase con el token del asesor) la saltea, y como además dispara comisión automática al aprobar, un asesor podría auto-aprobarse una venta y generarse su propia comisión sin que la RLS lo impida.

Ya está documentado como pendiente en `MODELO_ROLES.md §5`, pero el punto que señala esa nota es otro (si el líder debería poder editar `estado` de su equipo). El gap del asesor auto-aprobando su propia alta no tiene nota, y para un CRM donde aprobar = liquidar comisión, es el que yo priorizaría. La forma correcta de cerrarlo es a nivel RLS (columna restringida o una policy de `UPDATE` separada que excluya `estado` para quien no sea admin), no agregando otro chequeo en otra server action — si aparece un tercer código path para tocar `altas`, vuelve a estar expuesto.

## 5. Preguntas para decidir antes de tocar el modelo

Antes de proponer un `alta_id` en `activities`, una tabla de versiones de `alta_items`, o una policy nueva en `altas_update`, necesito que me confirmes:

1. ¿El escenario de "alta rechazada → se reintenta con otra prepaga" pasa seguido, o es marginal? Si es marginal, capaz alcanza con incluir el `alta_id` en la `description` en vez de una columna nueva.
2. ¿Vale la pena loguear cada documento completado como actividad, o el checklist actual (completado_by/completado_at por item) ya es suficiente trazabilidad para lo que necesitás mostrarle a una prepaga si audita un trámite?
3. Sobre el gap de RLS en `altas_update`: ¿lo tratamos ahora como parte de este trabajo de trazabilidad, o lo dejamos anotado para una pasada de seguridad aparte? Dado que ya tenés `AUDITORIA_RLS_2026-08-08.md` como documento vivo, podría sumarse ahí en vez de acá.
