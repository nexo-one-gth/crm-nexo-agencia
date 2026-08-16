'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { LeadCard } from './LeadCard'
import {
    MessageCircle, Clock, CheckCircle2, AlertCircle, UserMinus,
    Plus, FileUp, UserCheck, X, Filter, ChevronDown, ChevronRight,
    User, Search, RefreshCw, SortAsc, ArrowUpDown, AlertTriangle, DollarSign, Trash2,
    LayoutGrid, Columns
} from 'lucide-react'
import { ImportLeadsDialog } from './ImportLeadsDialog'
import { CreateLeadDialog } from './CreateLeadDialog'
import { MassAssignDialog } from './MassAssignDialog'
import { MessageTemplateDialog } from './MessageTemplateDialog'
import { AlertDialog } from '@/components/ui/AlertDialog'
import { useRouter } from 'next/navigation'
import { deleteLeads } from '@/app/actions/lead-actions'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getStageColor } from '@/lib/stage-colors'

interface Lead {
    id: string
    first_name: string
    last_name: string
    phone: string
    email?: string
    dni?: string
    address_state?: string
    address_city?: string
    obra_social?: string
    cantidad_integrantes?: number
    notes?: string
    created_at: string
    stage_name: string
    assigned_to?: string
    assigned_to_name?: string
    discard_reason?: string
    // Campos de cotización
    numero_tramite?: string
    edades?: string
    cuil?: string
    cuit_empleador?: string
    plan?: string
    valor_plan?: number
    descuento_aportes?: number
    descuento_comercial?: number
    iva?: number
    valor_final_socio?: number
    valor_forecast?: number
    observaciones_cotizacion?: string
    interest_level?: number
    source?: string
    documentacion_pendiente?: string
}

type AdvisorToAdmin = Record<string, { id: string; name: string }>

interface LeadFunnelBoardProps {
    initialLeads: Lead[]
    isAdmin?: boolean
    isAdminPrincipal?: boolean
    /**
     * Conduce equipo (admin | admin_principal | supervisor). Se calcula en el server
     * con isSupervisorOrAdminRole(): habilita la columna de descartes. Es distinto de
     * `isAdmin`, que acá significa "gestiona el reparto de leads".
     */
    conduceEquipo?: boolean
    advisorToAdmin?: AdvisorToAdmin
    initialStage?: string
    userProfile?: {
        full_name: string | null
        whatsapp_name: string | null
    } | null
}

// El color de cada etapa viene de stage-colors.ts (única fuente de verdad, compartida
// con LeadCard) para que el header de columna, la banda lateral de la card y el botón
// de avance de etapa siempre pinten lo mismo.
//
// El tablero corta en "Cotizado" a propósito: 'Alta en Proceso' y 'Ganado' siguen
// existiendo en pipeline_stages y el flujo cotización→alta las sigue seteando, pero
// el embudo es gestión comercial previa. Una vez iniciada el alta, el lead se sigue
// en /altas y /comisiones. No agregar acá esas columnas de nuevo: si hace falta ver
// cuántas altas hay, el dato vive en /altas.
//
// `audiencia` define quién ve la columna. Se resuelve con flags que llegan del server
// (derivadas de los helpers de assert-admin), no con listas de roles escritas acá:
//   'todos'      → cualquier usuario del CRM
//   'admin'      → admin | admin_principal (reparto de leads sin asignar)
//   'conduccion' → quien conduce equipo: admin | admin_principal | supervisor
type StageAudiencia = 'todos' | 'admin' | 'conduccion'

const STAGES: Array<{
    name: string
    icon: typeof Clock
    gradient: string
    solid: string
    text: string
    bg: string
    border: string
    audiencia: StageAudiencia
}> = [
    { name: 'Pendiente de Asignación', icon: UserMinus, ...getStageColor('Pendiente de Asignación'), audiencia: 'admin' },
    { name: 'Pendiente', icon: Clock, ...getStageColor('Pendiente'), audiencia: 'todos' },
    { name: 'Contactado', icon: MessageCircle, ...getStageColor('Contactado'), audiencia: 'todos' },
    { name: 'Interesado', icon: CheckCircle2, ...getStageColor('Interesado'), audiencia: 'todos' },
    { name: 'Cotizado', icon: DollarSign, ...getStageColor('Cotizado'), audiencia: 'todos' },
    // El descarte lo hace el asesor (botón X de la card) pero la columna es de
    // revisión: la ve quien conduce equipo, para auditar motivos y recuperar leads.
    { name: 'No Interesado', icon: AlertCircle, ...getStageColor('No Interesado'), audiencia: 'conduccion' },
]

type SortMode = 'recent' | 'name' | 'forecast'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'recent', label: 'Más reciente' },
    { value: 'name', label: 'Nombre A-Z' },
    { value: 'forecast', label: 'Mayor forecast' },
]

const sortLeads = (leads: Lead[], mode: SortMode): Lead[] => {
    return [...leads].sort((a, b) => {
        if (mode === 'name') return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        if (mode === 'forecast') return (b.valor_forecast ?? 0) - (a.valor_forecast ?? 0)
        // recent: newest first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

export const LeadFunnelBoard = ({ initialLeads, isAdmin, isAdminPrincipal, conduceEquipo, advisorToAdmin, initialStage, userProfile }: LeadFunnelBoardProps) => {
    const leads = initialLeads
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [templateStage, setTemplateStage] = useState<string | null>(null)
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [discardFilter, setDiscardFilter] = useState<string>('all')
    // Los grupos (Admin/Asesor) arrancan contraídos: primero se ve la lista de
    // asesores y recién al abrir uno aparecen sus leads.
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [searchQuery, setSearchQuery] = useState('')
    const [sortMode, setSortMode] = useState<SortMode>('recent')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [showSortMenu, setShowSortMenu] = useState(false)
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
    const [isCompactView, setIsCompactView] = useState(false)
    const [, setTick] = useState(0)
    const desktopBoardRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    // Etapa pendiente de scrollear en el board desktop. handleStageChange se pasa
    // como onStageChange a través de renderLeadsByAdvisor → renderAdvisorGroup →
    // LeadCard (varias capas de props hasta la card que dispara el cambio); si esa
    // función lee desktopBoardRef.current directamente, el análisis de refs la
    // marca como acceso a ref durante el render en cuanto se interpola en JSX,
    // aunque en los hechos solo se ejecute en un click. Separado así: el handler
    // que viaja por props solo guarda el destino (sin refs) y dispara el contador;
    // el efecto de abajo hace el scroll real — ahí sí está permitido leer el ref,
    // corre después del commit. El contador (no un booleano) evita tener que
    // resetear estado dentro del propio efecto para poder rescrollear a la misma
    // columna dos veces seguidas.
    const scrollToStageRef = useRef<string | null>(null)
    const [scrollTrigger, setScrollTrigger] = useState(0)
    const router = useRouter()

    const effectiveStages = useMemo(() => STAGES.filter(s => {
        if (s.audiencia === 'admin') return !!isAdmin
        if (s.audiencia === 'conduccion') return !!conduceEquipo
        return true
    }), [isAdmin, conduceEquipo])

    const initialTabIndex = initialStage
        ? effectiveStages.findIndex(s => s.name === initialStage)
        : 0
    const [activeTab, setActiveTab] = useState(initialTabIndex >= 0 ? initialTabIndex : 0)

    // Guarda de índice: si el set de columnas se achica (etapa removida, cambio de
    // permisos), un activeTab viejo apuntaría fuera del array y el selector móvil
    // reventaría al leer effectiveStages[activeTab].
    const safeTab = activeTab < effectiveStages.length ? activeTab : 0

    // Actualización automática cuando cambian leads via Realtime.
    // Debounced: un import o una asignación masiva dispara decenas de eventos
    // seguidos sobre la tabla completa. Sin debounce, cada evento individual
    // disparaba su propio router.refresh() (recarga completa del Server
    // Component) para cada usuario conectado, incluso si el cambio no le
    // afectaba a esa persona en particular.
    useEffect(() => {
        const supabase = createClient()
        let debounceId: ReturnType<typeof setTimeout> | null = null
        const channel = supabase
            .channel('leads-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                if (debounceId) clearTimeout(debounceId)
                debounceId = setTimeout(() => {
                    router.refresh()
                    setLastRefresh(new Date())
                }, 800)
            })
            .subscribe()
        return () => {
            if (debounceId) clearTimeout(debounceId)
            supabase.removeChannel(channel)
        }
    }, [router])

    // Re-render cada 60s para actualizar el label "hace X min" del timestamp
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60_000)
        return () => clearInterval(id)
    }, [])

    // Detectar si el tablero desktop tiene más columnas para scrollear, para mostrar flechas/fade
    const checkBoardScroll = useCallback(() => {
        const el = desktopBoardRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 4)
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    }, [])

    useEffect(() => {
        checkBoardScroll()
        window.addEventListener('resize', checkBoardScroll)
        return () => window.removeEventListener('resize', checkBoardScroll)
    }, [checkBoardScroll, effectiveStages.length, isCompactView])

    const scrollBoardBy = (amount: number) => {
        desktopBoardRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
    }

    // --- Computed / Memoized ---

    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return leads
        const q = searchQuery.toLowerCase().trim()
        return leads.filter(l =>
            `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
            l.phone.includes(q) ||
            (l.dni && l.dni.includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q))
        )
    }, [leads, searchQuery])

    const pendingDocsCount = useMemo(() =>
        leads.filter(l => l.documentacion_pendiente).length
        , [leads])

    const computeStageLeads = useCallback((stageName: string): Lead[] => {
        const staged = filteredLeads.filter(l => {
            if (l.stage_name !== stageName) return false
            if (stageName === 'No Interesado' && discardFilter !== 'all') {
                return l.discard_reason === discardFilter
            }
            return true
        })
        return sortLeads(staged, sortMode)
    }, [filteredLeads, discardFilter, sortMode])

    // Memoizado por etapa: antes se recalculaba filter+sort del array completo
    // hasta ~12 veces por render (contador del selector móvil + contenido activo
    // + las columnas desktop), sin memoización.
    const stageLeadsByName = useMemo(() => {
        const map: Record<string, Lead[]> = {}
        for (const stage of effectiveStages) {
            map[stage.name] = computeStageLeads(stage.name)
        }
        return map
    }, [effectiveStages, computeStageLeads])

    const getStageLeads = useCallback(
        (stageName: string): Lead[] => stageLeadsByName[stageName] ?? [],
        [stageLeadsByName]
    )

    // --- Handlers ---

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode)
        setSelectedLeads([])
    }

    const handleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleSelectAll = (stageName: string, stageLeads: Lead[]) => {
        const stageLeadIds = stageLeads.map(l => l.id)
        const allSelected = stageLeadIds.every(id => selectedLeads.includes(id))
        if (allSelected) {
            setSelectedLeads(prev => prev.filter(id => !stageLeadIds.includes(id)))
        } else {
            setSelectedLeads(prev => {
                const newIds = stageLeadIds.filter(id => !prev.includes(id))
                return [...prev, ...newIds]
            })
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        router.refresh()
        setTimeout(() => {
            setIsRefreshing(false)
            setLastRefresh(new Date())
        }, 800)
    }

    const handleDeleteLeads = () => {
        if (selectedLeads.length === 0) return
        setIsDeleteAlertOpen(true)
    }

    const handleDeleteLeadsConfirm = async () => {
        const result = await deleteLeads(selectedLeads)
        if (result.success) {
            toast.success(`${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''} eliminado${selectedLeads.length !== 1 ? 's' : ''} correctamente`)
            setSelectedLeads([])
            setIsSelectionMode(false)
            handleRefresh()
        } else {
            toast.error('Error al eliminar leads: ' + result.error)
        }
    }

    const handleStageChange = useCallback((newStageName: string) => {
        const stageIdx = effectiveStages.findIndex(s => s.name === newStageName)
        if (stageIdx === -1) return
        // Mobile: cambiar tab activo
        setActiveTab(stageIdx)
        // Desktop: pide el scroll; el efecto de más abajo lo ejecuta (ver comentario en scrollToStageRef)
        scrollToStageRef.current = newStageName
        setScrollTrigger(t => t + 1)
    }, [effectiveStages])

    useEffect(() => {
        if (scrollTrigger === 0 || !scrollToStageRef.current) return
        const col = desktopBoardRef.current?.querySelector(`[data-stage="${scrollToStageRef.current}"]`)
        col?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
    }, [scrollTrigger])

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const formatLastRefresh = useCallback((date: Date): string => {
        const diff = Math.floor((Date.now() - date.getTime()) / 1000)
        if (diff < 60) return 'Ahora'
        if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
        return `hace ${Math.floor(diff / 3600)}h`
    }, [])

    // --- Render helpers ---

    const renderAdvisorGroup = (advisor: string, advisorLeads: Lead[], groupId: string, compact: boolean, onStageChange?: (s: string) => void, indent = false) => {
        const isExpanded = !!expandedGroups[groupId]
        return (
            <div key={groupId} className="space-y-2">
                <button
                    onClick={() => toggleGroup(groupId)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all group ${
                        indent
                            ? 'bg-white/3 hover:bg-white/8 border-white/8'
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${advisor === 'Sin Asignar' ? 'bg-slate-500/10' : 'bg-blue-500/10'}`}>
                            <User className={`w-3.5 h-3.5 ${advisor === 'Sin Asignar' ? 'text-slate-500' : 'text-blue-500'}`} />
                        </div>
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{advisor}</p>
                            <p className="text-[10px] text-slate-500">{advisorLeads.length} lead{advisorLeads.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                    }
                </button>

                {isExpanded && (
                    <div className="space-y-4 pl-2 border-l-2 border-white/10 animate-in slide-in-from-top-2 duration-300">
                        {advisorLeads.map((lead) => (
                            <LeadCard
                                key={lead.id}
                                lead={lead}
                                isAdmin={isAdmin}
                                isSelected={selectedLeads.includes(lead.id)}
                                onSelect={isSelectionMode ? handleSelectLead : undefined}
                                userProfile={userProfile}
                                compact={compact}
                                onStageChange={onStageChange}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const renderLeadsByAdvisor = (stageLeads: Lead[], stageName: string, compact = false, onStageChange?: (s: string) => void) => {
        if (stageLeads.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-2xl opacity-40">
                    <p className="text-xs font-medium">
                        {searchQuery ? 'Sin resultados' : 'Sin prospectos'}
                    </p>
                </div>
            )
        }

        if (!isAdmin) {
            return (
                <div className="space-y-4">
                    {stageLeads.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            isAdmin={isAdmin}
                            isSelected={selectedLeads.includes(lead.id)}
                            onSelect={isSelectionMode ? handleSelectLead : undefined}
                            userProfile={userProfile}
                            compact={compact}
                            onStageChange={onStageChange}
                        />
                    ))}
                </div>
            )
        }

        // Admin principal: agrupado por Admin → Asesor → Leads
        if (isAdminPrincipal && advisorToAdmin && Object.keys(advisorToAdmin).length > 0) {
            // Agrupar leads por admin_id, luego por asesor
            const leadsByAdmin: Record<string, { adminName: string; byAdvisor: Record<string, Lead[]> }> = {}

            for (const lead of stageLeads) {
                const adminInfo = lead.assigned_to ? advisorToAdmin[lead.assigned_to] : null
                const adminKey = adminInfo?.id ?? '__sin_admin__'
                const adminName = adminInfo?.name ?? 'Sin Admin asignado'
                const advisorName = lead.assigned_to_name || 'Sin Asignar'

                if (!leadsByAdmin[adminKey]) {
                    leadsByAdmin[adminKey] = { adminName, byAdvisor: {} }
                }
                if (!leadsByAdmin[adminKey].byAdvisor[advisorName]) {
                    leadsByAdmin[adminKey].byAdvisor[advisorName] = []
                }
                leadsByAdmin[adminKey].byAdvisor[advisorName].push(lead)
            }

            const adminKeys = Object.keys(leadsByAdmin).sort((a, b) => {
                if (a === '__sin_admin__') return 1
                if (b === '__sin_admin__') return -1
                return leadsByAdmin[a].adminName.localeCompare(leadsByAdmin[b].adminName)
            })

            return (
                <div className="space-y-3">
                    {adminKeys.map(adminKey => {
                        const { adminName, byAdvisor } = leadsByAdmin[adminKey]
                        const adminGroupId = `${stageName}-admin-${adminKey}`
                        const isAdminExpanded = !!expandedGroups[adminGroupId]
                        const totalLeads = Object.values(byAdvisor).flat().length

                        const advisorNames = Object.keys(byAdvisor).sort((a, b) => {
                            if (a === 'Sin Asignar') return 1
                            if (b === 'Sin Asignar') return -1
                            return a.localeCompare(b)
                        })

                        return (
                            <div key={adminGroupId} className="space-y-2">
                                {/* Cabecera de Admin */}
                                <button
                                    onClick={() => toggleGroup(adminGroupId)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-purple-500/20">
                                            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-bold text-purple-300">{adminName}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {totalLeads} lead{totalLeads !== 1 ? 's' : ''} · {advisorNames.length} asesor{advisorNames.length !== 1 ? 'es' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    {isAdminExpanded
                                        ? <ChevronDown className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                                        : <ChevronRight className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                                    }
                                </button>

                                {isAdminExpanded && (
                                    <div className="pl-3 border-l-2 border-purple-500/20 space-y-2 animate-in slide-in-from-top-2 duration-300">
                                        {advisorNames.map(advisorName => {
                                            const advisorLeads = byAdvisor[advisorName]
                                            const groupId = `${stageName}-${adminKey}-${advisorName}`
                                            return renderAdvisorGroup(advisorName, advisorLeads, groupId, compact, onStageChange, true)
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )
        }

        // Admin regular: agrupado por asesor
        const leadsByAdvisor = stageLeads.reduce((acc, lead) => {
            const key = lead.assigned_to_name || 'Sin Asignar'
            if (!acc[key]) acc[key] = []
            acc[key].push(lead)
            return acc
        }, {} as Record<string, Lead[]>)

        const advisors = Object.keys(leadsByAdvisor).sort((a, b) => {
            if (a === 'Sin Asignar') return 1
            if (b === 'Sin Asignar') return -1
            return a.localeCompare(b)
        })

        return (
            <div className="space-y-3">
                {advisors.map(advisor => {
                    const groupId = `${stageName}-${advisor}`
                    return renderAdvisorGroup(advisor, leadsByAdvisor[advisor], groupId, compact, onStageChange)
                })}
            </div>
        )
    }

    const WhatsAppTemplateButton = ({ stageName }: { stageName: string }) =>
        ['Pendiente', 'Contactado', 'Interesado'].includes(stageName) ? (
            <button
                onClick={() => setTemplateStage(stageName)}
                aria-label="Configurar mensaje inicial de WhatsApp"
                className="group relative p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 dark:text-green-500 transition-colors"
                title="Configurar mensaje inicial"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[11px] font-bold bg-slate-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Configurar mensaje
                </span>
            </button>
        ) : null

    return (
        <div className="space-y-3 sm:space-y-4">

            {/* ===== TOOLBAR PRINCIPAL ===== */}
            <div className="flex flex-col gap-2 p-3 sm:p-4 glass-card rounded-2xl animate-in slide-in-from-top duration-500">

                {/* Fila 1: Acciones + Refresh */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nuevo Prospecto</span>
                            <span className="sm:hidden">Nuevo</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setIsImportOpen(true)}
                                aria-label="Importar leads"
                                className="px-3 sm:px-4 py-2 rounded-xl glass-button text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:scale-105 transition-all"
                            >
                                <FileUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Importar</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={toggleSelectionMode}
                                aria-pressed={isSelectionMode}
                                aria-label={isSelectionMode ? 'Cancelar selección masiva' : 'Activar selección masiva'}
                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${isSelectionMode ? 'bg-amber-500 text-white' : 'glass-button text-slate-600 dark:text-slate-400'}`}
                            >
                                {isSelectionMode ? <X className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                <span className="hidden sm:inline">{isSelectionMode ? 'Cancelar' : 'Selección masiva'}</span>
                            </button>
                        )}

                        {/* Badge docs pendientes */}
                        {pendingDocsCount > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    {pendingDocsCount} con doc. pendiente
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Refresh + toggle vista compacta + timestamp */}
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 font-medium">Actualizado</span>
                            <span className="text-[10px] text-slate-500">{formatLastRefresh(lastRefresh)}</span>
                        </div>
                        {/* Solo visible en desktop donde aplica el board de columnas */}
                        <button
                            onClick={() => setIsCompactView(prev => !prev)}
                            aria-pressed={isCompactView}
                            aria-label={isCompactView ? 'Cambiar a vista normal' : 'Cambiar a vista compacta'}
                            className={`hidden md:flex p-2 rounded-xl glass-button transition-all items-center gap-1.5 text-xs font-bold ${isCompactView ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-slate-500 dark:text-slate-400'}`}
                            title={isCompactView ? 'Vista normal' : 'Vista compacta'}
                        >
                            {isCompactView
                                ? <Columns className="w-4 h-4" />
                                : <LayoutGrid className="w-4 h-4" />
                            }
                            <span className="hidden lg:inline">{isCompactView ? 'Normal' : 'Compacta'}</span>
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            aria-label="Actualizar leads"
                            className="p-2 rounded-xl glass-button text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-50"
                            title="Actualizar leads"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Fila 2: Buscador + Ordenamiento */}
                <div className="flex items-center gap-2">
                    {/* Search input */}
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            aria-label="Buscar leads por nombre, teléfono, DNI o email"
                            placeholder="Buscar por nombre, teléfono, DNI o email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-8 py-2 rounded-xl glass-input text-base sm:text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                aria-label="Limpiar búsqueda"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Sort dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            aria-haspopup="true"
                            aria-expanded={showSortMenu}
                            aria-label="Ordenar leads"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-button text-slate-600 dark:text-slate-400 text-xs font-bold whitespace-nowrap transition-all"
                            title="Ordenar"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                                {SORT_OPTIONS.find(o => o.value === sortMode)?.label}
                            </span>
                        </button>

                        {showSortMenu && (
                            <div className="absolute right-0 top-full mt-1 z-50 py-1.5 min-w-[160px] rounded-xl backdrop-blur-xl bg-white/90 dark:bg-slate-800/95 border border-white/40 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                                {SORT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setSortMode(opt.value); setShowSortMenu(false) }}
                                        className={`w-full text-left px-4 py-2 text-[11px] font-bold transition-colors flex items-center gap-2 ${sortMode === opt.value
                                            ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white'
                                            }`}
                                    >
                                        <SortAsc className="w-3 h-3" />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Fila 3: Búsqueda activa + filtro asesores + selección masiva CTA */}
                <div className="flex items-center gap-2 flex-wrap">
                    {searchQuery && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Search className="w-3 h-3 text-blue-500" />
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                {filteredLeads.length} resultado{filteredLeads.length !== 1 ? 's' : ''} para &quot;{searchQuery}&quot;
                            </span>
                        </div>
                    )}
                    {isSelectionMode && selectedLeads.length > 0 && (
                        <button
                            onClick={() => setIsAssignOpen(true)}
                            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[11px] font-bold flex items-center gap-1.5 hover:scale-105 transition-all shadow-lg animate-in zoom-in duration-200"
                        >
                            <UserCheck className="w-3.5 h-3.5" />
                            Asignar {selectedLeads.length} seleccionado{selectedLeads.length !== 1 ? 's' : ''}
                        </button>
                    )}
                    {isSelectionMode && selectedLeads.length > 0 && (
                        <button
                            onClick={handleDeleteLeads}
                            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-600 to-red-600 text-white text-[11px] font-bold flex items-center gap-1.5 hover:scale-105 transition-all shadow-lg animate-in zoom-in duration-200"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar {selectedLeads.length} seleccionado{selectedLeads.length !== 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>

            {/* ===== TABS MÓVIL (< md) ===== */}
            <div className="md:hidden">
                {/* Selector de etapa: tira horizontal scrolleable en vez de desplegable.
                    Todas las etapas quedan a la vista y la activa se mantiene iluminada
                    con el color de su etapa (bg + text + border de stage-colors). */}
                <div
                    role="tablist"
                    aria-label="Etapa del embudo"
                    className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 py-0.5"
                >
                    {effectiveStages.map((stage, idx) => {
                        const count = getStageLeads(stage.name).length
                        const isActive = safeTab === idx
                        return (
                            <button
                                key={stage.name}
                                role="tab"
                                aria-selected={isActive}
                                // La inactiva queda sólo con el ícono, así que el nombre y el
                                // conteo tienen que viajar en el rótulo accesible y en el tooltip:
                                // sin esto el botón se anuncia vacío y no hay forma de saber qué es.
                                aria-label={`${stage.name} · ${count} lead${count !== 1 ? 's' : ''}`}
                                title={`${stage.name} · ${count} lead${count !== 1 ? 's' : ''}`}
                                onClick={() => setActiveTab(idx)}
                                className={`shrink-0 flex items-center gap-2 py-2.5 rounded-xl text-[13px] font-bold border transition-all ${
                                    isActive
                                        ? `px-3 ${stage.bg} ${stage.text} ${stage.border} shadow-sm`
                                        : 'px-2.5 glass-input border-white/20 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                <stage.icon className="w-4 h-4 shrink-0" />
                                {isActive && (
                                    <>
                                        <span className="whitespace-nowrap">{stage.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                                            {count}
                                        </span>
                                    </>
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="mt-3">
                    {/* eslint-disable-next-line react-hooks/refs -- falso positivo verificado: no
                        hay lectura de ref en este bloque. STAGES trae `icon: typeof Clock` (los
                        íconos de lucide-react son forwardRef por dentro) y esa forma de dato,
                        iterada acá vía effectiveStages.map, es lo que dispara esta regla
                        experimental (v7) — se confirmó eliminando la única lectura de ref real
                        que había (handleStageChange leía desktopBoardRef.current; se movió a un
                        efecto, ver scrollToStageRef más arriba) sin que este hallazgo cambiara. */}
                    {effectiveStages.map((stage, idx) => {
                        if (idx !== safeTab) return null
                        const stageLeads = getStageLeads(stage.name)

                        return (
                            <div key={stage.name} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isSelectionMode && (
                                            <button
                                                onClick={() => handleSelectAll(stage.name, stageLeads)}
                                                className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-all border ${stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id))
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white/5 border-white/20 text-slate-500'
                                                    }`}
                                            >
                                                {stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id)) ? 'Quitar todos' : 'Todos'}
                                            </button>
                                        )}
                                        <span className={`text-sm font-bold ${stage.text}`}>{stageLeads.length} leads</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Sin guarda de rol: la columna ya solo existe para quien conduce equipo */}
                                        {stage.name === 'No Interesado' && (
                                            <div className="relative">
                                                <select
                                                    value={discardFilter}
                                                    onChange={(e) => setDiscardFilter(e.target.value)}
                                                    aria-label="Filtrar por motivo de descarte"
                                                    className="appearance-none pl-6 pr-2 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 cursor-pointer"
                                                >
                                                    <option value="all">Todos</option>
                                                    <option value="No responde">No responde</option>
                                                    <option value="Preexistencia">Preexistencia</option>
                                                    <option value="Embarazo en curso">Embarazo en curso</option>
                                                    <option value="Rango de edad incorrecto">Rango de edad</option>
                                                    <option value="Solo consulta">Solo consulta</option>
                                                </select>
                                                <Filter className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                            </div>
                                        )}
                                        <WhatsAppTemplateButton stageName={stage.name} />
                                    </div>
                                </div>

                                <div className="max-h-[calc(100vh-360px)] overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                    {renderLeadsByAdvisor(stageLeads, stage.name, false, handleStageChange)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ===== COLUMNAS DESKTOP (>= md) — columnas flexibles, scroll horizontal si no entran todas ===== */}
            <div className="hidden md:block relative">
                <div
                    ref={desktopBoardRef}
                    onScroll={checkBoardScroll}
                    className="flex gap-4 h-[calc(100vh-300px)] overflow-x-auto overflow-y-hidden custom-scrollbar pb-2"
                    style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' } as React.CSSProperties}
                >
                    {/* eslint-disable-next-line react-hooks/refs -- mismo falso positivo que el
                        bloque de tabs móvil de más arriba; ver ese comentario. */}
                    {effectiveStages.map((stage) => {
                        const stageLeads = getStageLeads(stage.name)

                        return (
                            <div key={stage.name} data-stage={stage.name} className={`flex-1 ${isCompactView ? 'basis-[230px] min-w-[210px] max-w-[260px]' : 'basis-[270px] min-w-[240px] max-w-[320px]'} flex flex-col h-full transition-all duration-200`} style={{ scrollSnapAlign: 'start' }}>
                            {/* Column header */}
                            <div className={`p-3.5 rounded-2xl mb-4 flex items-center justify-between ${stage.bg} border border-white/10 shrink-0`}>
                                <div className="flex items-center gap-2">
                                    <stage.icon className={`w-4 h-4 ${stage.text}`} />
                                    <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-tight">{stage.name}</h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {isSelectionMode && (
                                        <button
                                            onClick={() => handleSelectAll(stage.name, stageLeads)}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all border ${stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id))
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white/5 border-white/20 text-slate-500 hover:bg-white/10'
                                                }`}
                                        >
                                            {stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id)) ? '✓ Todos' : 'Todos'}
                                        </button>
                                    )}
                                    {/* Sin guarda de rol: la columna ya solo existe para quien conduce equipo */}
                                    {stage.name === 'No Interesado' && (
                                        <div className="relative">
                                            <select
                                                value={discardFilter}
                                                onChange={(e) => setDiscardFilter(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Filtrar por motivo de descarte"
                                                className="appearance-none pl-5 pr-2 py-1 rounded-lg text-[11px] font-bold bg-white/10 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-white/20 transition-colors focus:outline-none"
                                            >
                                                <option value="all">Todos</option>
                                                <option value="No responde">No responde</option>
                                                <option value="Preexistencia">Preexistencia</option>
                                                <option value="Embarazo en curso">Embarazo en curso</option>
                                                <option value="Rango de edad incorrecto">Rango de edad</option>
                                                <option value="Solo consulta">Solo consulta</option>
                                            </select>
                                            <Filter className="w-2.5 h-2.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    )}
                                    <WhatsAppTemplateButton stageName={stage.name} />
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 tabular-nums">
                                        {stageLeads.length}
                                    </span>
                                </div>
                            </div>

                            {/* Scrollable card list */}
                            <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-0">
                                {renderLeadsByAdvisor(stageLeads, stage.name, isCompactView, handleStageChange)}
                            </div>
                        </div>
                    )
                })}
                </div>

                {/* Fades + flechas: avisan que hay más columnas para scrollear */}
                {canScrollLeft && (
                    <>
                        <div
                            className="pointer-events-none absolute left-0 top-0 bottom-2 w-12 z-10"
                            style={{ background: 'linear-gradient(to right, var(--background) 30%, transparent 100%)' }}
                        />
                        <button
                            onClick={() => scrollBoardBy(-300)}
                            aria-label="Ver columnas anteriores"
                            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full glass-button flex items-center justify-center hover:scale-105 transition-all shadow-lg"
                        >
                            <ChevronRight className="w-4 h-4 rotate-180 text-slate-600 dark:text-slate-300" />
                        </button>
                    </>
                )}
                {canScrollRight && (
                    <>
                        <div
                            className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 z-10"
                            style={{ background: 'linear-gradient(to left, var(--background) 30%, transparent 100%)' }}
                        />
                        <button
                            onClick={() => scrollBoardBy(300)}
                            aria-label="Ver más columnas"
                            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full glass-button flex items-center justify-center hover:scale-105 transition-all shadow-lg"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                    </>
                )}
            </div>

            {/* ===== MODALS ===== */}
            <ImportLeadsDialog
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={handleRefresh}
            />

            <MassAssignDialog
                isOpen={isAssignOpen}
                onClose={() => {
                    setIsAssignOpen(false)
                    setIsSelectionMode(false)
                    setSelectedLeads([])
                }}
                leadIds={selectedLeads}
                onSuccess={handleRefresh}
            />

            <MessageTemplateDialog
                isOpen={templateStage !== null}
                onClose={() => setTemplateStage(null)}
                stageName={templateStage || 'Pendiente'}
            />

            <CreateLeadDialog
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleRefresh}
            />

            <AlertDialog
                isOpen={isDeleteAlertOpen}
                onClose={() => setIsDeleteAlertOpen(false)}
                onConfirm={handleDeleteLeadsConfirm}
                title={`Eliminar ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''}`}
                description={`¿Seguro que querés eliminar ${selectedLeads.length} lead${selectedLeads.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
            />
        </div>
    )
}
