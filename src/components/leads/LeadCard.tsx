'use client'

import { Phone, MessageCircle, ChevronDown, MessageSquare, Edit, CheckCircle2, AlertCircle, Users, ExternalLink, Trash2, Calculator, X } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { updateLeadStage, deleteLeads } from '@/app/actions/lead-actions'
import { calculateLeadCompletion, getCompletionColor } from '@/lib/utils/lead-completion'
import { getStageColor } from '@/lib/stage-colors'
import { DISCARD_REASON_GROUPS } from '@/lib/leads/discard-reasons'

import { toast } from 'sonner'

import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LeadCommentsModal } from '@/components/leads/LeadCommentsModal'
import { LeadEditModal } from '@/components/leads/LeadEditModal'
import { AlertDialog } from '@/components/ui/AlertDialog'

interface LeadCardProps {
    compact?: boolean
    onStageChange?: (newStageName: string) => void
    lead: {
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
        // Nuevos campos migración crm-lh
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
        // Alerta de documentación
        documentacion_pendiente?: string
    }
    isSelected?: boolean
    onSelect?: (id: string) => void
    isAdmin?: boolean
    userProfile?: {
        full_name: string | null
        whatsapp_name: string | null
    } | null
}

const FLAME_COLORS = ['text-slate-400', 'text-yellow-500', 'text-orange-500']

// Etapas del embudo de medicina prepaga — el color de cada una viene de stage-colors.ts
// (única fuente de verdad, compartida con LeadFunnelBoard) para que la banda lateral,
// el header de columna y este botón de avance siempre coincidan.
const PIPELINE_STAGES = [
    { key: 'Pendiente', label: 'Lead', color: getStageColor('Pendiente').solid },
    { key: 'Contactado', label: 'Contactado', color: getStageColor('Contactado').solid },
    { key: 'Interesado', label: 'Interesado', color: getStageColor('Interesado').solid },
    { key: 'Cotizado', label: 'Cotizado', color: getStageColor('Cotizado').solid },
    { key: 'Alta en Proceso', label: 'Alta', color: getStageColor('Alta en Proceso').solid },
    { key: 'Ganado', label: 'Ganado', color: getStageColor('Ganado').solid },
] as const

const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return null
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)
}

export const LeadCard = ({ lead, isSelected, onSelect, isAdmin, userProfile, compact = false, onStageChange }: LeadCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
    const [isUpdatingStage, setIsUpdatingStage] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const discardRef = useRef<HTMLDivElement>(null)
    const discardButtonRef = useRef<HTMLButtonElement>(null)
    const discardMenuRef = useRef<HTMLDivElement>(null)
    // El menú se dibuja en un portal sobre <body> con position: fixed, así que su
    // posición hay que calcularla a mano a partir del rect del botón.
    const [discardMenuPos, setDiscardMenuPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
    const router = useRouter()

    const hasQuoteData = lead.plan || lead.valor_final_socio || lead.valor_forecast
    const interestLevel = lead.interest_level ?? 0

    useEffect(() => {
        if (!isDiscardOpen) return
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            // Hay que chequear los dos refs: el menú vive en un portal fuera de la
            // tarjeta, así que sin esto elegir un motivo contaría como click "afuera"
            // y el menú se cerraría antes de que dispare el onClick de la opción.
            if (discardRef.current?.contains(target)) return
            if (discardMenuRef.current?.contains(target)) return
            setIsDiscardOpen(false)
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDiscardOpen(false)
                discardButtonRef.current?.focus()
            }
        }
        // El menú es fixed: no acompaña a la tarjeta cuando se scrollea la columna,
        // así que se cierra en vez de quedar flotando en un lugar equivocado. Pero el
        // propio menú puede tener scroll interno (maxHeight): ese no lo cierra.
        const handleScroll = (event: Event) => {
            const target = event.target as Node | null
            if (target && discardMenuRef.current?.contains(target)) return
            setIsDiscardOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('scroll', handleScroll, true)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('scroll', handleScroll, true)
        }
    }, [isDiscardOpen])

    // Posicionamiento del menú: se mide después de montarlo (por eso useLayoutEffect,
    // para no mostrar un frame en la posición equivocada), se da vuelta hacia abajo si
    // arriba no entra y se recorta a los bordes del viewport.
    useLayoutEffect(() => {
        if (!isDiscardOpen) {
            setDiscardMenuPos(null)
            return
        }
        const positionMenu = () => {
            const button = discardButtonRef.current
            const menu = discardMenuRef.current
            if (!button || !menu) return
            const MARGIN = 8
            const GAP = 6
            const buttonRect = button.getBoundingClientRect()
            const menuWidth = menu.offsetWidth
            const menuHeight = menu.scrollHeight
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            const spaceAbove = buttonRect.top - MARGIN - GAP
            const spaceBelow = viewportHeight - buttonRect.bottom - MARGIN - GAP
            // Preferimos abrir hacia arriba (el botón está al pie de la tarjeta y así no
            // tapa la tarjeta siguiente), pero si no entra y abajo sobra lugar, lo damos vuelta.
            const openUp = spaceAbove >= menuHeight || spaceAbove >= spaceBelow
            const maxHeight = Math.max(140, Math.min(menuHeight, openUp ? spaceAbove : spaceBelow))
            const effectiveHeight = Math.min(menuHeight, maxHeight)

            const top = openUp
                ? Math.max(MARGIN, buttonRect.top - GAP - effectiveHeight)
                : Math.min(viewportHeight - MARGIN - effectiveHeight, buttonRect.bottom + GAP)
            // Alineado a la derecha del botón, pero sin salirse por el costado: las
            // columnas del embudo miden entre 210px y 320px.
            const left = Math.min(
                Math.max(MARGIN, buttonRect.right - menuWidth),
                Math.max(MARGIN, viewportWidth - menuWidth - MARGIN)
            )
            setDiscardMenuPos({ top, left, maxHeight })
        }
        positionMenu()
        window.addEventListener('resize', positionMenu)
        return () => window.removeEventListener('resize', positionMenu)
    }, [isDiscardOpen])

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsWhatsAppModalOpen(true)
    }

    const handleStageUpdate = async (newStageName: string, discardReason?: string) => {
        if (isUpdatingStage) return // evita doble-click accidental disparando dos cambios de etapa
        setIsUpdatingStage(true)
        const result = await updateLeadStage(lead.id, newStageName, discardReason)
        if (result.success) {
            const msg = discardReason
                ? `Descartado: ${discardReason}`
                : `Etapa actualizada a ${newStageName}`
            toast.success(msg)
            onStageChange?.(newStageName)
            router.refresh()
        } else {
            toast.error('Error al actualizar la etapa: ' + result.error)
        }
        setIsUpdatingStage(false)
    }

    const handleDiscard = (reason: string) => {
        setIsDiscardOpen(false)
        handleStageUpdate('No Interesado', reason)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsDeleteAlertOpen(true)
    }

    const handleDeleteConfirm = async () => {
        setIsDeleting(true)
        const result = await deleteLeads([lead.id])
        if (result.success) {
            toast.success('Lead eliminado correctamente')
            router.refresh()
        } else {
            toast.error('Error al eliminar lead: ' + result.error)
            setIsDeleting(false)
        }
    }

    const completion = calculateLeadCompletion(lead)
    const completionStyle = getCompletionColor(completion)

    const stageGradient = getStageColor(lead.stage_name).gradient

    const getUrgencySignal = (created_at: string, stageName: string) => {
        const days = Math.floor((Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24))
        // "Sin contacto" solo es una alarma real mientras el lead sigue en Pendiente.
        // Una vez que avanzó de etapa, ya sabemos que fue contactado: mostrar la antigüedad, no una falsa urgencia.
        const isUncontacted = stageName === 'Pendiente' || stageName === 'Pendiente de Asignación'
        if (days === 0) return { text: 'Ingresó hoy', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
        if (!isUncontacted) return { text: `Ingresó hace ${days} día${days === 1 ? '' : 's'}`, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20' }
        if (days === 1) return { text: 'Sin contacto: 1 día', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' }
        if (days <= 3) return { text: `Sin contacto: ${days} días`, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' }
        return { text: `Sin contacto: ${days} días`, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' }
    }

    const urgency = getUrgencySignal(lead.created_at, lead.stage_name)

    return (
        <>
            <div
                onClick={() => onSelect && onSelect(lead.id)}
                className={`glass-card overflow-hidden rounded-2xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300 group shadow-sm flex bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 ${onSelect ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-blue-500/50' : interestLevel === 2 ? 'ring-1 ring-orange-400/50' : ''}`}
            >
                {/* === BANDA DE COLOR LATERAL === */}
                <div className={`w-1.5 shrink-0 bg-gradient-to-b ${stageGradient} opacity-80`} />

                {/* === CONTENIDO PRINCIPAL === */}
                <div className={`flex-1 flex flex-col min-w-0 ${compact ? 'gap-2 p-2.5' : 'gap-3 p-4'}`}>

                    {/* Fila 1: Header — el nombre es el ancla visual principal, la urgencia va al lado para escaneo en <2s */}
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col min-w-0 pr-2 gap-1">
                            <div className="flex items-center gap-2">
                                <h4 className="text-[15px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100 truncate" title={`${lead.first_name} ${lead.last_name !== '.' ? lead.last_name : ''}`}>
                                    {lead.first_name} {lead.last_name !== '.' ? lead.last_name : ''}
                                </h4>
                                {lead.cantidad_integrantes && lead.cantidad_integrantes > 1 && (
                                    <div className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[9px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0 px-1">
                                        <Users className="w-2.5 h-2.5" />
                                        {lead.cantidad_integrantes}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{lead.edades ? `Edades: ${lead.edades}` : 'Sin edades'}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${urgency.color}`}>
                                    {urgency.text}
                                </span>
                            </div>
                        </div>

                        {/* Controles top-right */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsEditOpen(true)
                                }}
                                className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400"
                                title="Editar"
                            >
                                <Edit className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={handleDelete}
                                    className="w-7 h-7 rounded-md hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center transition-all text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {onSelect && (
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-50 border-blue-500/30' : 'border-slate-200 dark:border-white/10'}`}>
                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: Badges (Interés, Origen, Asesor) — ocultos en vista compacta */}
                    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'hidden' : ''}`}>
                        <div className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 flex items-center gap-1 max-w-[120px] truncate">
                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${stageGradient}`} />
                            <span className="truncate">{lead.plan || 'Sin especificar'}</span>
                            {interestLevel > 0 && <span className={`${FLAME_COLORS[interestLevel]} text-[10px]`}>🔥</span>}
                        </div>

                        <div className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-white/5 truncate max-w-[90px]">
                            {lead.source || 'Ads'}
                        </div>

                        {/* Motivo de descarte: sin esto, "No Interesado" no dice por qué se perdió el lead */}
                        {lead.stage_name === 'No Interesado' && lead.discard_reason && (
                            <div className="px-2 py-1 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 truncate max-w-[140px]">
                                {lead.discard_reason}
                            </div>
                        )}
                    </div>

                    {/* Fila 3: Avance de etapa */}
                    {(() => {
                        const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.stage_name)
                        const nextStage = currentIdx >= 0 && currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null
                        const prevStage = currentIdx > 0 ? PIPELINE_STAGES[currentIdx - 1] : null
                        const isAltaNext = nextStage?.key === 'Alta en Proceso'
                        return (
                            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-white/5" ref={discardRef}>
                                {prevStage && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleStageUpdate(prevStage.key) }}
                                        disabled={isUpdatingStage}
                                        className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                                        title={`Volver a ${prevStage.label}`}
                                    >
                                        <ChevronDown className="w-3 h-3 rotate-90" />
                                    </button>
                                )}
                                {nextStage && (
                                    isAltaNext ? (
                                        <Link
                                            href={`/leads/${lead.id}?tab=quote`}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm ${nextStage.color}`}
                                            title="Iniciar Alta desde cotización"
                                        >
                                            <ChevronDown className="w-3 h-3 -rotate-90" />
                                            {nextStage.label}
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStageUpdate(nextStage.key) }}
                                            disabled={isUpdatingStage}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold text-white flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:pointer-events-none ${nextStage.color}`}
                                            title={`Avanzar a ${nextStage.label}`}
                                        >
                                            <ChevronDown className="w-3 h-3 -rotate-90" />
                                            {nextStage.label}
                                        </button>
                                    )
                                )}
                                <div className="relative">
                                    <button
                                        ref={discardButtonRef}
                                        onClick={(e) => { e.stopPropagation(); setIsDiscardOpen(prev => !prev) }}
                                        disabled={isUpdatingStage}
                                        aria-label="Marcar como No Interesado"
                                        aria-haspopup="menu"
                                        aria-expanded={isDiscardOpen}
                                        title="No interesado"
                                        className={`py-2 px-2.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none ${isDiscardOpen ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-500' : 'bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-500'}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    {/* Portal a <body>: la tarjeta tiene overflow-hidden y un transform en hover,
                                        y la columna del embudo tiene overflow-y-auto. Cualquiera de los tres recorta
                                        un menú absolute, y el z-index no puede contra overflow: hidden. */}
                                    {isDiscardOpen && createPortal(
                                        <div
                                            ref={discardMenuRef}
                                            role="menu"
                                            aria-label="Motivo de descarte"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                top: discardMenuPos?.top ?? 0,
                                                left: discardMenuPos?.left ?? 0,
                                                maxHeight: discardMenuPos?.maxHeight,
                                                // Se monta invisible para poder medirlo sin que parpadee en 0,0.
                                                visibility: discardMenuPos ? 'visible' : 'hidden',
                                            }}
                                            className="fixed w-52 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-[120] overflow-y-auto custom-scrollbar"
                                        >
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 pt-1.5 pb-1">Motivo de descarte</p>
                                            {DISCARD_REASON_GROUPS.map((group, groupIndex) => (
                                                <div
                                                    key={group.key}
                                                    className={groupIndex > 0 ? 'mt-1 pt-1.5 border-t border-slate-100 dark:border-white/5' : ''}
                                                >
                                                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-300 dark:text-slate-500 px-3 pb-0.5">
                                                        {group.label}
                                                    </p>
                                                    {group.reasons.map(reason => (
                                                        <button
                                                            key={reason.value}
                                                            role="menuitem"
                                                            onClick={(e) => { e.stopPropagation(); handleDiscard(reason.value) }}
                                                            className="w-full text-left px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                                        >
                                                            {reason.value}
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>,
                                        document.body
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    {/* Fila 4: Controles — la urgencia ya se ve en la Fila 1, el score de completitud
                        se movió al detalle expandido (no aporta a la decisión "a quién contactar" a simple vista) */}
                    {(() => {
                        return (
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
                                    className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                                    title={isExpanded ? 'Colapsar' : 'Ver más'}
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Alerta puntual solo cuando faltan muchos datos — reemplaza el score permanente */}
                                    {completion < 30 && (
                                        <div className="w-6 h-6 flex items-center justify-center" title={`Datos incompletos: ${completion}%`}>
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                        </div>
                                    )}
                                    <a
                                        href={`tel:${lead.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95"
                                        title={`Llamar a ${lead.phone}`}
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                    </a>
                                    <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(e) }} className="w-7 h-7 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-all shadow-sm active:scale-95" title="Enviar WhatsApp">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    {['Contactado', 'Interesado', 'Cotizado'].includes(lead.stage_name) && (
                                        <Link
                                            href={`/leads/${lead.id}?tab=quote`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                                            title="Cotizar"
                                        >
                                            <Calculator className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                    <Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all" title="Vista Completa">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )
                    })()}

                    {/* === CONTENIDO EXPANDIDO === */}
                    {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-1 text-[10px]">
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Teléfono</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{lead.phone}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">En Pipeline</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: es })}
                                    </p>
                                </div>
                                {lead.obra_social && (
                                    <div className="space-y-0.5">
                                        <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Obra Social</span>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{lead.obra_social}</p>
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Fecha Ingreso</span>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{new Date(lead.created_at).toLocaleDateString('es-AR')}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Datos completos</span>
                                    <p className={`font-semibold ${completionStyle.split(' ')[0]}`}>{completion}%</p>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true) }}
                                className="w-full mt-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                                <MessageSquare className="w-3 h-3" /> Ver Historial
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Expanded Content (Renderizados fuera del div transformado para evitar recortes de overflow-hidden) */}
            <WhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                lead={lead}
                userName={userProfile?.full_name || undefined}
            />

            {isEditOpen && (
                <LeadEditModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    lead={lead}
                />
            )}

            {isCommentsOpen && (
                <LeadCommentsModal
                    isOpen={isCommentsOpen}
                    onClose={() => setIsCommentsOpen(false)}
                    leadId={lead.id}
                    leadName={`${lead.first_name} ${lead.last_name}`}
                />
            )}

            <AlertDialog
                isOpen={isDeleteAlertOpen}
                onClose={() => setIsDeleteAlertOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Eliminar lead"
                description={`¿Seguro que querés eliminar a ${lead.first_name}? Esta acción no se puede deshacer.`}
                confirmLabel={isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                cancelLabel="Cancelar"
            />
        </>
    )
}
