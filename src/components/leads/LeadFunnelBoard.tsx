'use client'

import { useState, useMemo } from 'react'
import { LeadCard } from './LeadCard'
import {
    MessageCircle, Clock, CheckCircle2, AlertCircle, UserMinus,
    Plus, FileUp, UserCheck, X, Filter, ChevronDown, ChevronRight,
    User, Search, RefreshCw, SortAsc, ArrowUpDown, AlertTriangle, DollarSign
} from 'lucide-react'
import { ImportLeadsDialog } from './ImportLeadsDialog'
import { CreateLeadDialog } from './CreateLeadDialog'
import { MassAssignDialog } from './MassAssignDialog'
import { MessageTemplateDialog } from './MessageTemplateDialog'
import { useRouter } from 'next/navigation'

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

interface LeadFunnelBoardProps {
    initialLeads: Lead[]
    isAdmin?: boolean
    userProfile?: {
        full_name: string | null
        whatsapp_name: string | null
    } | null
}

const STAGES = [
    { name: 'Pendiente de Asignación', icon: UserMinus, color: 'text-slate-500', bgColor: 'bg-slate-500/10', tabColor: 'border-slate-400', adminOnly: true },
    { name: 'Pendiente', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', tabColor: 'border-amber-400', adminOnly: false },
    { name: 'Contactado', icon: MessageCircle, color: 'text-blue-500', bgColor: 'bg-blue-500/10', tabColor: 'border-blue-400', adminOnly: false },
    { name: 'Interesado', icon: CheckCircle2, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', tabColor: 'border-indigo-400', adminOnly: false },
    { name: 'Cotizado', icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', tabColor: 'border-emerald-400', adminOnly: false },
    { name: 'Alta en Proceso', icon: FileUp, color: 'text-purple-500', bgColor: 'bg-purple-500/10', tabColor: 'border-purple-400', adminOnly: false },
    { name: 'Ganado', icon: UserCheck, color: 'text-green-500', bgColor: 'bg-green-500/10', tabColor: 'border-green-400', adminOnly: false },
    { name: 'No Interesado', icon: AlertCircle, color: 'text-slate-500', bgColor: 'bg-slate-500/10', tabColor: 'border-slate-400', adminOnly: false },
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

export const LeadFunnelBoard = ({ initialLeads, isAdmin, userProfile }: LeadFunnelBoardProps) => {
    const [leads] = useState(initialLeads)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [templateStage, setTemplateStage] = useState<string | null>(null)
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [discardFilter, setDiscardFilter] = useState<string>('all')
    const [activeTab, setActiveTab] = useState(0)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [searchQuery, setSearchQuery] = useState('')
    const [sortMode, setSortMode] = useState<SortMode>('recent')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [showSortMenu, setShowSortMenu] = useState(false)
    const router = useRouter()

    const effectiveStages = isAdmin ? STAGES : STAGES.filter(s => !s.adminOnly)

    // --- Computed / Memoized ---

    // Leads filtered by search query
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

    const getStageLeads = (stageName: string): Lead[] => {
        const staged = filteredLeads.filter(l => {
            if (l.stage_name !== stageName) return false
            if (stageName === 'No Interesado' && discardFilter !== 'all') {
                return l.discard_reason === discardFilter
            }
            return true
        })
        return sortLeads(staged, sortMode)
    }

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

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
    }

    const formatLastRefresh = (date: Date) => {
        const diff = Math.floor((Date.now() - date.getTime()) / 1000)
        if (diff < 60) return 'Ahora'
        if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
        return `hace ${Math.floor(diff / 3600)}h`
    }

    // --- Render helpers ---

    const renderLeadsByAdvisor = (stageLeads: Lead[], stageName: string) => {
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
                <div className="space-y-3">
                    {stageLeads.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            isAdmin={isAdmin}
                            isSelected={selectedLeads.includes(lead.id)}
                            onSelect={isSelectionMode ? handleSelectLead : undefined}
                            userProfile={userProfile}
                        />
                    ))}
                </div>
            )
        }

        // Admin: agrupado por asesor
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
                    const advisorLeads = leadsByAdvisor[advisor]
                    const groupId = `${stageName}-${advisor}`
                    const isExpanded = expandedGroups[groupId]

                    return (
                        <div key={groupId} className="space-y-2">
                            <button
                                onClick={() => toggleGroup(groupId)}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
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
                                <div className="space-y-3 pl-2 border-l-2 border-white/10 animate-in slide-in-from-top-2 duration-300">
                                    {advisorLeads.map((lead) => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            isAdmin={isAdmin}
                                            isSelected={selectedLeads.includes(lead.id)}
                                            onSelect={isSelectionMode ? handleSelectLead : undefined}
                                            userProfile={userProfile}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    const WhatsAppTemplateButton = ({ stageName }: { stageName: string }) =>
        ['Pendiente', 'Contactado', 'Interesado'].includes(stageName) ? (
            <button
                onClick={() => setTemplateStage(stageName)}
                className="group relative p-1 rounded-lg hover:bg-green-500/10 text-green-600 dark:text-green-500 transition-colors"
                title="Configurar mensaje inicial"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-bold bg-slate-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
                                className="px-3 sm:px-4 py-2 rounded-xl glass-button text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:scale-105 transition-all"
                            >
                                <FileUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Importar</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={toggleSelectionMode}
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

                    {/* Refresh + timestamp */}
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-medium">Actualizado</span>
                            <span className="text-[9px] text-slate-500">{formatLastRefresh(lastRefresh)}</span>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
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
                            placeholder="Buscar por nombre, teléfono, DNI o email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-8 py-2 rounded-xl glass-input text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
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

                {/* Fila 3: Búsqueda activa + selección masiva CTA */}
                <div className="flex items-center gap-2 flex-wrap">
                    {searchQuery && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Search className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                {filteredLeads.length} resultado{filteredLeads.length !== 1 ? 's' : ''} para "{searchQuery}"
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
                </div>
            </div>

            {/* ===== TABS MÓVIL (< md) ===== */}
            <div className="md:hidden">
                <div className="flex overflow-x-auto hide-scrollbar gap-1 pb-1">
                    {effectiveStages.map((stage, idx) => {
                        const count = getStageLeads(stage.name).length
                        const isActive = activeTab === idx
                        return (
                            <button
                                key={stage.name}
                                onClick={() => setActiveTab(idx)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 border-b-2 ${isActive
                                    ? `${stage.bgColor} ${stage.tabColor} ${stage.color}`
                                    : 'bg-white/5 border-transparent text-slate-500 dark:text-slate-400'
                                    }`}
                            >
                                <stage.icon className="w-3.5 h-3.5" />
                                <span className="max-w-[80px] truncate">{stage.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/10 dark:bg-white/10' : 'bg-black/5 dark:bg-white/5'}`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="mt-3">
                    {effectiveStages.map((stage, idx) => {
                        if (idx !== activeTab) return null
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
                                        <span className={`text-sm font-bold ${stage.color}`}>{stageLeads.length} leads</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {stage.name === 'No Interesado' && isAdmin && (
                                            <div className="relative">
                                                <select
                                                    value={discardFilter}
                                                    onChange={(e) => setDiscardFilter(e.target.value)}
                                                    className="appearance-none pl-6 pr-2 py-1 rounded-lg text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 cursor-pointer"
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
                                    {renderLeadsByAdvisor(stageLeads, stage.name)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ===== COLUMNAS DESKTOP (>= md) ===== */}
            <div className="hidden md:flex gap-4 h-[calc(100vh-300px)] overflow-hidden">
                {effectiveStages.map((stage) => {
                    const stageLeads = getStageLeads(stage.name)

                    return (
                        <div key={stage.name} className="flex-1 flex flex-col min-w-[240px]">
                            {/* Column header */}
                            <div className={`p-3 rounded-xl mb-3 flex items-center justify-between ${stage.bgColor} border border-white/10 shrink-0`}>
                                <div className="flex items-center gap-2">
                                    <stage.icon className={`w-4 h-4 ${stage.color}`} />
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
                                    {stage.name === 'No Interesado' && isAdmin && (
                                        <div className="relative">
                                            <select
                                                value={discardFilter}
                                                onChange={(e) => setDiscardFilter(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="appearance-none pl-5 pr-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-white/20 transition-colors focus:outline-none"
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
                                {renderLeadsByAdvisor(stageLeads, stage.name)}
                            </div>
                        </div>
                    )
                })}
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
        </div>
    )
}
