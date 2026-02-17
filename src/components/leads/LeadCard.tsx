'use client'

import { Phone, User, MessageCircle, Calendar, ChevronRight, ChevronDown, MessageSquare } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logWhatsAppActivity, updateLeadStage } from '@/app/actions/lead-actions'

import { toast } from 'sonner'

import { WhatsAppModal } from '@/components/leads/WhatsAppModal'
import { LeadCommentsModal } from '@/components/leads/LeadCommentsModal'

interface LeadCardProps {
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
    }
    isSelected?: boolean
    onSelect?: (id: string) => void
    isAdmin?: boolean
    userProfile?: {
        full_name: string | null
        whatsapp_name: string | null
    } | null
}

const DISCARD_REASONS = [
    'No responde',
    'Preexistencia',
    'Embarazo en curso',
    'Rango de edad incorrecto',
    'Solo consulta',
]

export const LeadCard = ({ lead, isSelected, onSelect, isAdmin, userProfile }: LeadCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    const discardRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (discardRef.current && !discardRef.current.contains(event.target as Node)) {
                setIsDiscardOpen(false)
            }
        }
        if (isDiscardOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isDiscardOpen])

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsWhatsAppModalOpen(true)
    }

    const handleStageUpdate = async (newStageName: string, discardReason?: string) => {
        const result = await updateLeadStage(lead.id, newStageName, discardReason)
        if (result.success) {
            const msg = discardReason
                ? `Descartado: ${discardReason}`
                : `Etapa actualizada a ${newStageName}`
            toast.success(msg)
            router.refresh()
        } else {
            toast.error('Error al actualizar la etapa: ' + result.error)
        }
    }

    const handleDiscard = (reason: string) => {
        setIsDiscardOpen(false)
        handleStageUpdate('No Interesado', reason)
    }

    return (
        <div
            onClick={() => onSelect ? onSelect(lead.id) : setIsExpanded(!isExpanded)}
            className={`glass-card p-3 sm:p-4 rounded-xl cursor-pointer hover:bg-white/15 transition-all duration-300 group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                }`}
        >
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {onSelect && (
                            <div className={`shrink-0 w-5 h-5 sm:w-4 sm:h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-white/20'
                                }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        )}
                        <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm sm:text-base">
                            {lead.first_name} {lead.last_name}
                        </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {lead.phone}
                        </p>
                        {lead.dni && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <span className="font-bold">DNI:</span> {lead.dni}
                            </p>
                        )}
                        {lead.email && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[150px]">
                                {lead.email}
                            </p>
                        )}
                        {(lead.address_city || lead.address_state) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 italic">
                                {lead.address_city && <span>{lead.address_city}</span>}
                                {lead.address_city && lead.address_state && <span>, </span>}
                                {lead.address_state && <span>{lead.address_state}</span>}
                            </p>
                        )}
                    </div>

                    {lead.stage_name === 'No Interesado' && lead.discard_reason && (
                        <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 w-fit">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                Motivo: {lead.discard_reason}
                            </span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 w-fit">
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                Asesor: {lead.assigned_to_name || 'Sin Asignar'}
                            </span>
                        </div>
                    )}
                </div>
                {/* WhatsApp button — larger touch target on mobile */}
                <button
                    onClick={handleWhatsApp}
                    className="p-2.5 sm:p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30 hover:border-green-500/50 transition-all shrink-0 active:scale-90"
                    title="WhatsApp"
                >
                    <MessageCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
            </div>

            <WhatsAppModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                lead={lead}
                userName={userProfile?.full_name || undefined}
            />

            {isExpanded && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px] sm:text-xs">DNI</span>
                            <p className="font-semibold">{lead.dni || 'S/D'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px] sm:text-xs">Email</span>
                            <p className="font-semibold truncate text-xs">{lead.email || 'S/D'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px] sm:text-xs">Obra Social</span>
                            <p className="font-semibold">{lead.obra_social || 'S/D'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-slate-500 uppercase font-bold tracking-tighter text-[10px] sm:text-xs">Ingreso</span>
                            <p className="font-semibold">{new Date(lead.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {lead.notes && (
                        <div className="p-2 rounded-lg bg-black/5 dark:bg-black/20 text-[11px] text-slate-600 dark:text-slate-400">
                            {lead.notes}
                        </div>
                    )}

                    {/* Action buttons — bigger touch targets on mobile */}
                    <div className="flex gap-2 pt-2">
                        {lead.stage_name === 'Pendiente' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStageUpdate('Contactado') }}
                                className="flex-1 py-2 sm:py-1 px-2 rounded-lg bg-blue-600 text-white text-xs sm:text-[10px] font-bold active:scale-95 transition-transform"
                            >
                                Marcar Contactado
                            </button>
                        )}
                        {lead.stage_name === 'Contactado' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStageUpdate('Interesado') }}
                                className="flex-1 py-2 sm:py-1 px-2 rounded-lg bg-purple-600 text-white text-xs sm:text-[10px] font-bold active:scale-95 transition-transform"
                            >
                                Interesado
                            </button>
                        )}
                        {(lead.stage_name === 'Pendiente' || lead.stage_name === 'Contactado' || lead.stage_name === 'Interesado') && (
                            <div ref={discardRef} className="relative flex-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsDiscardOpen(!isDiscardOpen) }}
                                    className="w-full py-2 sm:py-1 px-2 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-xs sm:text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-300 dark:hover:bg-white/15 transition-colors active:scale-95"
                                >
                                    Descartar <ChevronDown className={`w-3 h-3 transition-transform ${isDiscardOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isDiscardOpen && (
                                    <div className="absolute bottom-full mb-1 left-0 right-0 z-50 py-1 rounded-xl backdrop-blur-md bg-white/80 dark:bg-slate-800/90 border border-white/20 dark:border-white/10 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        {DISCARD_REASONS.map((reason) => (
                                            <button
                                                key={reason}
                                                onClick={(e) => { e.stopPropagation(); handleDiscard(reason) }}
                                                className="w-full text-left px-3 py-2 sm:py-1.5 text-xs sm:text-[11px] text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors first:rounded-t-xl last:rounded-b-xl"
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {lead.stage_name === 'Interesado' && (
                            <div className="flex-1 text-center py-2 px-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs sm:text-[10px] font-bold border border-green-500/20 flex items-center justify-center">
                                ¡Interesado!
                            </div>
                        )}
                        {isAdmin && !onSelect && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
                                className="text-xs sm:text-[10px] font-bold px-2 py-2 sm:py-1 rounded-lg bg-black/5"
                            >
                                Contraer
                            </button>
                        )}
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true) }}
                        className="w-full py-2.5 sm:py-2 rounded-lg bg-blue-600/10 dark:bg-blue-600/20 hover:bg-blue-600/30 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                        Comentarios <MessageSquare className="w-3 h-3" />
                    </button>
                </div>
            )}

            <LeadCommentsModal
                isOpen={isCommentsOpen}
                onClose={() => setIsCommentsOpen(false)}
                leadId={lead.id}
                leadName={`${lead.first_name} ${lead.last_name}`}
            />
        </div>
    )
}
