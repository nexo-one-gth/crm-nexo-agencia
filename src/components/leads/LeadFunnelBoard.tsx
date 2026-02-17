'use client'

import { useState } from 'react'
import { LeadCard } from './LeadCard'
import { MessageCircle, Clock, CheckCircle2, AlertCircle, UserMinus, Plus, FileUp, UserCheck, X, Filter, ChevronDown, ChevronRight, User } from 'lucide-react'
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
    { name: 'Pendiente de Asignación', icon: UserMinus, color: 'text-slate-500', bgColor: 'bg-slate-500/10', tabColor: 'border-slate-400' },
    { name: 'Pendiente', icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', tabColor: 'border-amber-400' },
    { name: 'Contactado', icon: MessageCircle, color: 'text-blue-500', bgColor: 'bg-blue-500/10', tabColor: 'border-blue-400' },
    { name: 'Interesado', icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', tabColor: 'border-green-400' },
    { name: 'No Interesado', icon: AlertCircle, color: 'text-slate-500', bgColor: 'bg-slate-500/10', tabColor: 'border-slate-400' },
]

export const LeadFunnelBoard = ({ initialLeads, isAdmin, userProfile }: LeadFunnelBoardProps) => {
    const [leads, setLeads] = useState(initialLeads)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [isTemplateOpen, setIsTemplateOpen] = useState(false)
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [discardFilter, setDiscardFilter] = useState<string>('all')
    const [activeTab, setActiveTab] = useState(0)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const router = useRouter()

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode)
        setSelectedLeads([])
    }

    const handleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleSelectAll = (stageName: string, leads: Lead[]) => {
        const stageLeadIds = leads.map(l => l.id)
        const allSelected = stageLeadIds.every(id => selectedLeads.includes(id))

        if (allSelected) {
            // Deselect all from this stage
            setSelectedLeads(prev => prev.filter(id => !stageLeadIds.includes(id)))
        } else {
            // Select all from this stage (avoid duplicates)
            setSelectedLeads(prev => {
                const newIds = stageLeadIds.filter(id => !prev.includes(id))
                return [...prev, ...newIds]
            })
        }
    }

    const handleRefresh = () => {
        router.refresh()
    }

    const effectiveStages = isAdmin ? STAGES : STAGES.filter(s => s.name !== 'Pendiente de Asignación')

    const getStageLeads = (stageName: string) => {
        return leads.filter(l => {
            if (l.stage_name !== stageName) return false
            if (stageName === 'No Interesado' && discardFilter !== 'all') {
                return l.discard_reason === discardFilter
            }
            return true
        })
    }

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }))
    }

    const renderLeadsByAdvisor = (stageLeads: Lead[], stageName: string) => {
        if (!isAdmin) {
            return (
                <div className="space-y-4">
                    {stageLeads.length > 0 ? (
                        stageLeads.map((lead) => (
                            <LeadCard
                                key={lead.id}
                                lead={lead}
                                isAdmin={isAdmin}
                                isSelected={selectedLeads.includes(lead.id)}
                                onSelect={isSelectionMode ? handleSelectLead : undefined}
                                userProfile={userProfile}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-2xl opacity-40">
                            <p className="text-xs font-medium">Sin prospectos</p>
                        </div>
                    )}
                </div>
            )
        }

        // Grouping logic for Admin
        const leadsByAdvisor = stageLeads.reduce((acc, lead) => {
            const advisorName = lead.assigned_to_name || 'Sin Asignar'
            if (!acc[advisorName]) acc[advisorName] = []
            acc[advisorName].push(lead)
            return acc
        }, {} as Record<string, Lead[]>)

        const advisors = Object.keys(leadsByAdvisor).sort((a, b) => {
            if (a === 'Sin Asignar') return 1
            if (b === 'Sin Asignar') return -1
            return a.localeCompare(b)
        })

        if (advisors.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-2xl opacity-40">
                    <p className="text-xs font-medium">Sin prospectos</p>
                </div>
            )
        }

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
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />}
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

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Toolbar — Visible for everyone now */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 glass-card rounded-2xl animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo</span> Prospecto v2
                    </button>

                    {isAdmin && (
                        <button
                            onClick={() => setIsImportOpen(true)}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl glass-button text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all"
                        >
                            <FileUp className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span> Leads
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            onClick={toggleSelectionMode}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${isSelectionMode ? 'bg-amber-500 text-white' : 'glass-button text-slate-600 dark:text-slate-400'
                                }`}
                        >
                            {isSelectionMode ? <X className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            <span className="hidden sm:inline">{isSelectionMode ? 'Cancelar Selección' : 'Selección Masiva'}</span>
                            <span className="sm:hidden">{isSelectionMode ? 'Cancelar' : 'Seleccionar'}</span>
                        </button>
                    )}
                </div>

                {isSelectionMode && selectedLeads.length > 0 && (
                    <button
                        onClick={() => setIsAssignOpen(true)}
                        className="px-4 sm:px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg animate-in zoom-in duration-300"
                    >
                        <UserCheck className="w-4 h-4" /> Asignar ({selectedLeads.length})
                    </button>
                )}
            </div>

            {/* Mobile Tabs — visible on < md */}
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

                {/* Active Stage Content — Mobile */}
                <div className="mt-3">
                    {effectiveStages.map((stage, idx) => {
                        if (idx !== activeTab) return null
                        const stageLeads = getStageLeads(stage.name)

                        return (
                            <div key={stage.name} className="space-y-3">
                                {/* Stage header with filters */}
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
                                                {stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id)) ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
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
                                                    <option value="Rango de edad incorrecto">Rango de edad incorrecto</option>
                                                    <option value="Solo consulta">Solo consulta</option>
                                                </select>
                                                <Filter className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                            </div>
                                        )}
                                        {stage.name === 'Pendiente' && (
                                            <button
                                                onClick={() => setIsTemplateOpen(true)}
                                                className="group relative p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors"
                                                title="Configurar mensaje inicial"
                                            >
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-bold bg-slate-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    Configurar mensaje inicial
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Cards grouped by Advisor */}
                                <div className="mt-2 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1">
                                    {renderLeadsByAdvisor(stageLeads, stage.name)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Desktop Columns — hidden on mobile */}
            <div className="hidden md:flex gap-6 h-[calc(100vh-280px)] overflow-hidden">
                {effectiveStages.map((stage) => {
                    const stageLeads = getStageLeads(stage.name)

                    return (
                        <div key={stage.name} className="flex-1 flex flex-col min-w-[260px]">
                            <div className={`p-4 rounded-xl mb-4 flex items-center justify-between ${stage.bgColor} border border-white/10`}>
                                <div className="flex items-center gap-2">
                                    <stage.icon className={`w-5 h-5 ${stage.color}`} />
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{stage.name}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isSelectionMode && (
                                        <button
                                            onClick={() => handleSelectAll(stage.name, stageLeads)}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all border ${stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id))
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white/5 border-white/20 text-slate-500 hover:bg-white/10'
                                                }`}
                                        >
                                            {stageLeads.length > 0 && stageLeads.every(l => selectedLeads.includes(l.id)) ? 'Deseleccionar' : 'Seleccionar Todos'}
                                        </button>
                                    )}
                                    {stage.name === 'No Interesado' && isAdmin && (
                                        <div className="relative">
                                            <select
                                                value={discardFilter}
                                                onChange={(e) => setDiscardFilter(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="appearance-none pl-6 pr-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 backdrop-blur-sm border border-white/20 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-white/20 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400/30"
                                            >
                                                <option value="all">Todos</option>
                                                <option value="No responde">No responde</option>
                                                <option value="Preexistencia">Preexistencia</option>
                                                <option value="Embarazo en curso">Embarazo en curso</option>
                                                <option value="Rango de edad incorrecto">Rango de edad incorrecto</option>
                                                <option value="Solo consulta">Solo consulta</option>
                                            </select>
                                            <Filter className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    )}
                                    {stage.name === 'Pendiente' && (
                                        <button
                                            onClick={() => setIsTemplateOpen(true)}
                                            className="group relative p-1 rounded-lg hover:bg-green-500/10 text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 transition-colors"
                                            title="Configurar mensaje inicial"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                            </svg>
                                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-bold bg-slate-800 text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                Configurar mensaje inicial
                                            </span>
                                        </button>
                                    )}
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                                        {stageLeads.length}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {renderLeadsByAdvisor(stageLeads, stage.name)}
                            </div>
                        </div>
                    )
                })}
            </div>

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
                isOpen={isTemplateOpen}
                onClose={() => setIsTemplateOpen(false)}
            />

            <CreateLeadDialog
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleRefresh}
            />
        </div>
    )
}
