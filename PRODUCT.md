# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres roles jerárquicos, todos internos de NEXO (no hay usuarios externos/clientes en el sistema):

- **Asesor:** vende seguros de salud/prepagas. Usa el CRM a diario, mayormente desde el celular y muchas veces en la calle (visitas, llamadas fuera de oficina). Necesita cargar y cotizar leads, dar de alta ventas, y ver sus propias comisiones y liquidaciones sin fricción táctil.
- **Admin de equipo:** conduce un grupo de asesores. Ve las ventas y leads de su equipo, reparte leads sin asignar.
- **Admin general / admin_principal:** ve todo sin filtro, gestiona admins y la configuración global (prepagas, reglas comisionales, campañas).

Caso testigo de la jerarquía: una misma persona puede ser admin de equipo (conduce asesores) y a la vez vender con cartera propia (rol de asesor). El modelo de datos y el diseño no pueden asumir que "admin" y "vendedor" son roles mutuamente excluyentes.

## Product Purpose

CRM comercial interno para gestionar el ciclo completo de venta de seguros de salud/prepagas: desde la asignación de un lead hasta la liquidación de la comisión del asesor que lo vendió. Reemplaza planillas y herramientas sueltas por un sistema único donde el asesor cotiza, da de alta la venta, y hace seguimiento de comisiones sin salir del CRM. Éxito = menos fricción operativa para el asesor y trazabilidad completa para el admin (quién tocó cada lead, cuándo, y en qué estado quedó cada venta y cada pago).

## Positioning

Arquitectura pensada para ser reutilizable entre verticales del grupo, no solo NEXO Salud: el modelo de roles (asesor → admin de equipo → admin general), la trazabilidad por lead, y el motor de comisiones/liquidaciones están diseñados para que otra vertical del grupo pueda correr sobre la misma base sin rehacer el sistema desde cero. Es lo que un CRM genérico (HubSpot, planillas) no ofrece: visibilidad por rol resuelta en RLS de Supabase (no solo en la UI) y un modelo de datos ya pensado para múltiples equipos/verticales.

## Operating Context

Flujo funcional del lead:

1. **Asignación:** manual, la hace un admin o admin de equipo. No hay reglas automáticas (round robin, zona, carga) todavía.
2. **Trazabilidad:** todo cambio de estado, interacción y quién tocó qué queda registrado (auditoría por lead).
3. **Cotización:** el asesor cotiza dentro del mismo CRM (cotizador embebido por prepaga, credenciales server-side).
4. **Alta:** desde una cotización aceptada se genera el alta sin salir del CRM (checklist documental + adjuntos a Storage).
5. **Comisiones y liquidaciones:** el asesor ve sus ventas, comisiones devengadas (por regla prepaga+segmento+origen) y liquidaciones agrupadas en lotes de cierre por prepaga+mes.

Uso predominante: mobile, en movimiento, entre visitas y llamadas — no solo sentado en un escritorio.

## Capabilities and Constraints

- Stack existente: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase (Postgres + Auth + RLS) + Vercel. Server Actions para todo el CRUD, sin API REST (salvo `/api/drive/carpeta`).
- La visibilidad por rol se resuelve en RLS de Supabase, no solo en frontend — es un CRM con datos de comisiones y ventas, la seguridad entre roles es crítica.
- Patrón de bug recurrente a evitar en cualquier UI/lógica nueva: listas de roles escritas a mano (`role === 'admin'`, `.in('role', [...])`) en vez de derivar del dato real (`admin_asesores`, `profiles.aparecer_en_tablero`, `supervisor_overrides`, `auth_asesores_visibles()`).
- Soft-delete: la mayoría de los leads sin asignar y de varias carteras están borrados por soft-delete (`deleted_at`). El RLS no lo filtra, la aplicación sí — al comparar números, siempre considerar `deleted_at IS NULL`.
- Pendiente conocido: 20 porcentajes de comisión de prepaga y 10 de asesor están todos en `100` (no reales); 4 prepagas activas sin reglas comisionales; auditoría RLS con hallazgos HIGH/MEDIUM sin aplicar (ver `AUDITORIA_RLS_2026-08-08.md`).
- Sin construir todavía: selector de alcance (mi cartera / mi equipo / toda la agencia), UI para overrides, facturación y margen, decomisión.

## Brand Commitments

- Nombre: NEXO Salud (vertical de NEXO). Logo en `public/nexo-salud-logo.png`.
- Sistema visual ya incumbente en el código: glass morphism (`.glass-card`, `.glass-button`, `.glass-input` en `globals.css`), tipografía Plus Jakarta Sans (headings) + Inter (body), fondo con gradientes radiales azul/púrpura/rosa sobre base rosada clara / slate oscuro (soporta light y dark). Se trata como evidencia de sistema de diseño incumbente, no como decisión a re-abrir en este documento.

## Evidence on Hand

Sin testimonios, casos de estudio ni contenido de marketing — es una herramienta interna, no un producto de cara a clientes externos. No fabricar evidencia de ese tipo en trabajo futuro.

## Product Principles

1. El dato manda sobre el rol: cualquier regla de visibilidad o permiso deriva de una relación o campo real (`admin_asesores`, `aparecer_en_tablero`, RLS), nunca de una lista de roles escrita a mano.
2. Mobile-first en la operación diaria: el asesor usa el CRM parado, entre visitas, con una mano — la UI de uso frecuente (leads, cotización, altas) prioriza legibilidad y alcance táctil por sobre densidad de información.
3. Una sola fuente de verdad por dato: cuando dos campos pueden representar lo mismo (ej. `altas.cuota` vs `leads.valor_final_socio`), se define cuál manda y se elimina o deja de usar el otro en vez de mantener ambos.
4. RLS es la autoridad de seguridad, no un respaldo: el filtrado por rol en Server Actions no reemplaza la política RLS: la política manda, el filtrado en código es defensa en profundidad, no la primera línea.
5. Reutilizable, no genérico: las decisiones de modelo de datos y roles se piensan para que otra vertical del grupo pueda adoptar la base sin reescritura, pero sin agregar abstracción especulativa que no resuelve un caso de uso real de hoy.

## Accessibility & Inclusion

Uso mobile-first en campo: los asesores operan mayormente desde el celular, a menudo fuera de oficina. Priorizar legibilidad, contraste suficiente sobre los fondos con gradiente/glass, y controles con área táctil cómoda para uso con una sola mano en las pantallas de uso diario (leads, cotización, altas, comisiones).
