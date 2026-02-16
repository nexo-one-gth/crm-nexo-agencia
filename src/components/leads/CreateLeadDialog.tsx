'use client'

import { useState } from 'react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import { UserPlus, Loader2 } from 'lucide-react'
import { createLead } from '@/app/actions/lead-actions'
import { toast } from 'sonner'

interface CreateLeadDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const CreateLeadDialog = ({ isOpen, onClose, onSuccess }: CreateLeadDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)

        const formData = new FormData(e.currentTarget)
        const values = {
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name') || '.',
            phone: formData.get('phone'),
            dni: formData.get('dni'),
            cuil: formData.get('cuil'),
            os: formData.get('os'),
            notes: formData.get('notes'),
            source: 'Manual'
        }

        const res = await createLead(values)

        if (res.success) {
            toast.success('Prospecto creado correctamente')
            onSuccess()
            onClose()
        } else {
            toast.error(res.error || 'Error al crear el prospecto')
        }
        setIsSubmitting(false)
    }

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={onClose}
            title="Nuevo Prospecto"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Nombre *</label>
                        <input
                            name="first_name"
                            required
                            placeholder="Ej: Juan"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Apellido</label>
                        <input
                            name="last_name"
                            placeholder="Ej: Pérez"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Teléfono *</label>
                        <input
                            name="phone"
                            required
                            placeholder="Ej: 1123456789"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">DNI</label>
                        <input
                            name="dni"
                            placeholder="Sin puntos"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Obra Social / Prepaga</label>
                    <input
                        name="os"
                        placeholder="Ej: OSDE, Swiss Medical..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Notas</label>
                    <textarea
                        name="notes"
                        rows={3}
                        placeholder="Información adicional relevante..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 transition-all text-sm outline-none resize-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <UserPlus className="w-5 h-5" />
                    )}
                    {isSubmitting ? 'Creando...' : 'Crear Prospecto'}
                </button>
            </form>
        </SimpleModal>
    )
}
