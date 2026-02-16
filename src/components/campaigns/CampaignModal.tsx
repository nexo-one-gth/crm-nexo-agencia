'use client'

import { useState, useEffect } from 'react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import { createCampaign, getAdvisors } from '@/app/actions/campaigns'
import { toast } from 'sonner'
import { Loader2, Users, Target, Calendar } from 'lucide-react'

interface CampaignModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const CampaignModal = ({
    isOpen,
    onClose,
    onSuccess,
}: CampaignModalProps) => {
    const [loading, setLoading] = useState(false)
    const [advisors, setAdvisors] = useState<any[]>([])
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        advisor_id: '',
        total_leads: 0,
        daily_rhythm: 0,
    })

    useEffect(() => {
        if (isOpen) {
            loadAdvisors()
        }
    }, [isOpen])

    const loadAdvisors = async () => {
        const data = await getAdvisors()
        setAdvisors(data)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await createCampaign({
                ...formData,
                total_leads: Number(formData.total_leads),
                daily_rhythm: Number(formData.daily_rhythm),
            })

            if (result.success) {
                toast.success('Campaña creada exitosamente')
                onSuccess()
                onClose()
                setFormData({
                    name: '',
                    description: '',
                    advisor_id: '',
                    total_leads: 0,
                    daily_rhythm: 0,
                })
            } else {
                toast.error(result.error || 'Error al crear la campaña')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <SimpleModal isOpen={isOpen} onClose={onClose} title="Nueva Campaña de Leads">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombre de la Campaña
                    </label>
                    <input
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Leads Prepaga AMBA"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Descripción (Opcional)
                    </label>
                    <textarea
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Detalles sobre la promoción..."
                        rows={2}
                        value={formData.description}
                        onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                        }
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Asignar Asesor
                    </label>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none select-glass"
                            value={formData.advisor_id}
                            onChange={(e) =>
                                setFormData({ ...formData, advisor_id: e.target.value })
                            }
                        >
                            <option value="" disabled className="bg-slate-900">
                                Seleccionar asesor...
                            </option>
                            {advisors.map((advisor) => (
                                <option
                                    key={advisor.id}
                                    value={advisor.id}
                                    className="bg-slate-900"
                                >
                                    {advisor.first_name} {advisor.last_name} ({advisor.email})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Total Leads
                        </label>
                        <div className="relative">
                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                required
                                min="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.total_leads || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        total_leads: Number(e.target.value),
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Ritmo Diario
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="number"
                                required
                                min="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.daily_rhythm || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        daily_rhythm: Number(e.target.value),
                                    })
                                }
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Campaña'}
                    </button>
                </div>
            </form>
        </SimpleModal>
    )
}
