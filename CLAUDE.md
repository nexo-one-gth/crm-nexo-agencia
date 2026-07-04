# 🏥 NEXO SALUD — CRM Agencia

CRM interno para asesores de seguros de salud (prepagas). Gestiona leads, embudo de ventas, altas, cotizaciones y prepagas. Stack: Next.js 15 + React 19 + TypeScript + Tailwind v4 + Supabase + Vercel.

---

## STACK Y CONFIGURACIÓN

- **Framework:** Next.js 15 (App Router, SSR puro — sin SSG)
- **UI:** React 19, Tailwind CSS v4, Framer Motion, Lucide React, Sonner
- **Base de datos:** Supabase (PostgreSQL), Auth con SSR via `@supabase/ssr`
- **APIs externas:** Google Drive (service account), Evolution API (WhatsApp)
- **Exports/imports:** `xlsx` para CSV/Excel, `date-fns` para fechas
- **Tipado:** TypeScript strict, Zod para validaciones de entrada
- **Hosting:** Vercel (free tier)
- **Path alias:** `@/*` → `src/*`

### Variables de entorno requeridas (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # NUNCA exponer al cliente
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

### Comandos
```
npm run dev      # desarrollo local
npm run build    # compilación
npm run lint     # eslint
```

---

## ARQUITECTURA DE LA APP

```
src/
├── app/                    # Next.js App Router
│   ├── actions/            # Server Actions (CRUD, sin API REST)
│   ├── api/drive/          # API route para Google Drive
│   ├── admin/              # Panel de administración
│   ├── altas/              # Flujo de afiliaciones
│   ├── funnel/             # Embudo visual (Kanban + Realtime)
│   ├── leads/              # Listado y detalle de leads
│   ├── login/              # Auth Supabase
│   ├── prepagas/           # Catálogo de prepagas
│   ├── recursos/           # Navegador Google Drive
│   ├── settings/           # Perfil de usuario
│   ├── layout.tsx          # Root layout: Navbar + BottomNav
│   └── page.tsx            # Dashboard
├── components/
│   ├── admin/              # Vistas admin (asesores, equipo)
│   ├── auth/               # SignOutButton
│   ├── campaigns/          # Gestión de campañas
│   ├── leads/              # LeadCard, LeadDetailView, modals
│   ├── prepagas/           # PrepagaCard, checklist, alta
│   ├── recursos/           # NavegadorDrive
│   ├── settings/           # ProfileCard
│   └── ui/                 # AlertDialog, BottomNav, BackButton, card
├── hooks/
│   ├── useCotizacion.ts    # Lógica de cotización con cálculos
│   └── useWhatsAppMessage.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Cliente browser (anon key)
│   │   ├── server.ts       # Cliente servidor (server-only)
│   │   ├── admin.ts        # Cliente con service role
│   │   ├── assert-admin.ts # Helpers de validación de rol
│   │   └── types.ts        # Tipos autogenerados (~1200 líneas)
│   ├── utils/
│   │   └── lead-completion.ts  # % completitud de leads
│   ├── google-drive.ts     # Integración Google Drive API
│   └── utils.ts            # Helpers genéricos (cn, formato, etc.)
├── types/
│   └── cotizacion.ts       # Tipos: integrantes, descuentos, IVA
└── middleware.ts            # Protección de rutas por auth
```

---

## RUTAS DE LA APLICACIÓN

| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/login` | Auth Supabase | Pública |
| `/` | Dashboard con stats y links filtrados a embudo | Todos |
| `/leads` | Listado de leads | Todos (filtrado por rol) |
| `/leads/[id]` | Detalle: edición, cotización, WhatsApp, historial | Todos |
| `/funnel` | Embudo visual Kanban con Realtime | Todos |
| `/prepagas` | Catálogo de prepagas | Todos |
| `/prepagas/[slug]` | Detalle: planes, documentación | Todos |
| `/prepagas/[slug]/cotizar` | Cotizador (iframe + credenciales server-side) | Todos |
| `/altas` | Listado de altas/afiliaciones | Todos |
| `/altas/[id]` | Checklist + adjuntos + estado | Todos |
| `/recursos` | Navegador Google Drive | Todos |
| `/settings` | Perfil, contraseña | Todos |
| `/admin` | Gestión de asesores y equipos | admin / admin_principal |
| `/admin/prepagas` | CRUD prepagas, planes, asesores, checklists | admin / admin_principal |
| `/admin/prepagas/calendarios` | Calendarios de eventos mensuales | admin / admin_principal |
| `/admin/campaigns` | Gestión de campañas | admin / admin_principal |

---

## JERARQUÍA DE ROLES

```
admin_principal
    └── admin (puede tener múltiples)
            └── asesor (puede tener múltiples)
```

**Reglas de visibilidad:**
- `asesor` → solo ve sus propios leads y prepagas asignadas
- `admin` → ve todos los leads y asesores de su equipo
- `admin_principal` → ve TODO sin filtro; gestiona todos los admins

**Helpers en `src/lib/supabase/assert-admin.ts`:**
- `assertAdmin()` — acepta `admin` o `admin_principal`
- `assertAdminPrincipal()` — solo `admin_principal`
- `isAdminRole()` — helper booleano

**Tablas clave de relación:**
- `profiles` — campo `role`: `asesor` | `admin` | `admin_principal`
- `admin_asesores` — relación N:M admin→asesores (con RLS activo)

---

## SCHEMA SUPABASE (TABLAS PRINCIPALES)

**Perfiles y auth:**
- `profiles` — id (= auth.uid), role, nombre, email, avatar_url
- `admin_asesores` — admin_id, asesor_id (N:M)

**Pipeline de ventas:**
- `leads` — nombre, contacto, etapa, prepaga_id, asesor_id, campaña_id
- `pipeline_stages` — P0 a P4 (etapas del embudo)
- `lead_cotizaciones` — cotización por lead (integrantes JSON, descuento, IVA)
- `activities` — historial de acciones en un lead

**Prepagas:**
- `prepagas` — slug, nombre, logo, descripción
- `prepaga_planes` — prepaga_id, nombre, cobertura, precio
- `prepaga_asesores` — asesor_id, prepaga_id, credenciales (JSON encriptado)
- `prepaga_asesores_safe` — vista sin credenciales (para frontend)
- `prepaga_eventos` — tipo (cierre/pago/vigencia), fecha, prepaga_id
- `checklist_plantillas` — plantilla de checklist por prepaga
- `checklist_plantilla_items` — ítems base (DNI, CUIL, comprobante, etc.)

**Altas (afiliaciones):**
- `altas` — lead_id, prepaga_id, estado (draft/enviada/completada)
- `alta_items` — ítem del checklist, archivo_path (Storage), completado

**Comisiones:**
- `prepaga_comision_reglas` — regla por prepaga + segmento + origen (origen NULL = aplica a todos los orígenes)
- `comisiones` — 1:1 con alta aprobada; snapshot de regla, origen, % del asesor y lote
- `cierres_comisionales` — lotes por prepaga + mes_periodo; ciclo abierto → cerrado → liquidado; liquidar el lote liquida todas sus comisiones
- `leads.origen` — `nexo` (importación) | `referido` (carga del asesor) | `campania` (importado/asignado con campaña); define la escala comisional

**Campañas y comunicación:**
- `campaigns` — nombre, descripción, fecha_inicio, fecha_fin
- `instancias_whatsapp` — instancias Evolution API
- `conversaciones` / `conversacion_mensajes` — historial WhatsApp

---

## PATRONES Y CONVENCIONES

### Server Actions (no API REST)
Todo el CRUD usa Server Actions en `src/app/actions/`. No hay endpoints REST salvo `/api/drive/carpeta`.

### Credenciales de prepagas
Las credenciales de cotizadores se leen **solo server-side** en `prepaga-actions.ts` → `getCredencialesCotizador()`. Nunca llegan al cliente.

### Clientes Supabase
- Componentes cliente → `lib/supabase/client.ts`
- Server Components / Actions → `lib/supabase/server.ts`
- Operaciones admin privilegiadas → `lib/supabase/admin.ts`

### RLS
Activo en `admin_asesores`, `prepaga_asesores`, `leads`. El filtrado por rol ocurre tanto en RLS como en las Server Actions para doble seguridad.

### Realtime
`LeadFunnelBoard.tsx` tiene subscription a cambios en `leads` para actualización en tiempo real del Kanban.

### Design System
- **Glass morphism**: `.glass-card`, `.glass-button`, `.glass-input` (definidos en `globals.css`)
- **Tipografía**: Plus Jakarta Sans (headings) + Inter (body) — via `next/font`
- **Fondo**: gradientes radiales azul/púrpura/rosa
- **Toast**: Sonner (`import { toast } from 'sonner'`)
- **Confirmaciones**: `AlertDialog.tsx` (reemplaza `confirm()` nativo)
- **Navegación móvil**: `BottomNav.tsx` — 4 ítems: Inicio | Embudo | [+Nuevo] | Ajustes; el botón central abre `CreateLeadDialog`

### Importar clases CSS
```ts
import { cn } from '@/lib/utils' // cn = clsx + tailwind-merge
```

---

## ESTADO ACTUAL DEL PROYECTO (junio 2026)

### Implementado ✅
- Auth completa con SSR (login, logout, sesiones persistentes)
- Dashboard con estadísticas y links filtrados por etapa del embudo
- Gestión completa de leads (CRUD, asignación, importación CSV/Excel)
- Embudo visual Kanban con Supabase Realtime
- Módulo Prepagas: 10 prepagas base, planes, checklists, calendarios de eventos
- Cotizador integrado por prepaga (iframe + credenciales server-side)
- Módulo Altas: checklist documental, carga de adjuntos a Storage
- Jerarquía de roles: admin_principal > admin > asesor
- Panel admin: gestión de asesores con cascada de equipos
- Módulo Recursos: navegador Google Drive integrado
- Campañas de marketing (CRUD)
- Módulo Comisiones: reglas por prepaga+segmento+origen, generación automática al aprobar alta, lotes de cierre comisional con liquidación por lote (`/comisiones`, `/admin/comisiones`)
- Glass design system completo

### Pendiente / Próximas fases 🚧
- **Fase 2 Prepagas**: cotizador integrado completo + Supabase Vault para credenciales
- **WhatsApp**: integración completa con Evolution API (instancias, conversaciones)
- **Automatizaciones**: workflows n8n conectados al CRM
- **Reportes**: módulo de analytics con exportación (Nicolas Ibarra territory)

---

## MIGRACIONES SQL (en orden)

```
supabase/migrations/
├── 20260301_sync_stages.sql           # Etapas del embudo
├── 20260310_add_missing_lead_fields.sql
├── 20260531_fix_rls_policies.sql      # Corrección de políticas RLS
├── 20260610_modulo_prepagas.sql       # 8 tablas del módulo prepagas
├── 20260614_cotizador_lead.sql        # lead_cotizaciones
├── 20260614_prepaga_credenciales_avalian.sql
├── 20260616_admin_principal_role.sql  # Rol admin_principal
├── 20260628_modulo_comisiones.sql     # prepaga_comision_reglas + comisiones + seed condiciones comerciales
├── 20260702_lead_assigned_at.sql      # assigned_at en leads + trigger (reporte admin)
├── 20260704_comisiones_origen_cierres.sql  # leads.origen + reglas por origen + cierres_comisionales (lotes)
└── add_lead_fields.sql                # Campos extra en leads
```

Para aplicar en Supabase: usar el MCP de Supabase (`apply_migration`) o el dashboard SQL editor.
