'use client'

import { useState, useEffect } from 'react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import { Users, Loader2, UserCheck } from 'lucide-react'
import { getAdvisors } from '@/app/actions/advisor-actions'
import { assignLeadsToAdvisor } from '@/app/actions/lead-actions'
import { toast } from 'sonner'

interface MassAssignDialogProps {
    isOpen: boolean
    onClose: () => void
    leadIds: string[]
    onSuccess: () => void
}

export const MassAssignDialog = ({ isOpen, onClose, leadIds, onSuccess }: MassAssignDialogProps) => {
    const [advisors, setAdvisors] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedAdvisor, setSelectedAdvisor] = useState('')

    useEffect(() => {
        if (isOpen) {
            fetchAdvisors()
        }
    }, [isOpen])

    const fetchAdvisors = async () => {
        setIsLoading(true)
        const res = await getAdvisors()
        if (res.success) {
            setAdvisors(res.data || [])
        }
        setIsLoading(false)
    }

    const handleAssign = async () => {
        if (!selectedAdvisor) return

        setIsSubmitting(true)
        const res = await assignLeadsToAdvisor(leadIds, selectedAdvisor)

        if (res.success) {
            toast.success(`${leadIds.length} leads asignados correctamente`)
            onSuccess()
            onClose()
        } else {
            toast.error(res.error || 'Error al asignar leads')
        }
        setIsSubmitting(false)
    }

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Asignar ${leadIds.length} leads`}
        >
            <div className="p-6 space-y-6">
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase text-slate-500 ml-1">Seleccionar Asesor</label>
                    <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : advisors.length > 0 ? (
                            advisors.map((advisor) => (
                                <button
                                    key={advisor.id}
                                    onClick={() => setSelectedAdvisor(advisor.id)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedAdvisor === advisor.id
                                            ? 'bg-blue-600/20 border-blue-500/50 shadow-lg'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-600 uppercase">
                                        {advisor.first_name?.[0]}{advisor.last_name?.[0]}
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-bold text-sm">{advisor.first_name} {advisor.last_name}</p>
                                        <p className="text-[10px] text-slate-500">{advisor.email}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-center text-slate-500 py-10">No se encontraron asesores</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleAssign}
                    disabled={isSubmitting || !selectedAdvisor}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <UserCheck className="w-5 h-5" />
                    )}
                    {isSubmitting ? 'Asignando...' : 'Confirmar Asignación'}
                </button>
            </div>
        </SimpleModal>
    )
}
