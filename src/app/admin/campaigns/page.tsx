'use client'

import { useState, useEffect } from 'react'
import { getCampaigns } from '@/app/actions/campaigns'
import { CampaignModal } from '@/components/campaigns/CampaignModal'
import { Plus, Target, Users, TrendingUp, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import { BackButton } from '@/components/ui/BackButton'

export default function AdminCampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const loadCampaigns = async () => {
        setLoading(true)
        const data = await getCampaigns()
        setCampaigns(data)
        setLoading(false)
    }

    useEffect(() => {
        loadCampaigns()
    }, [])

    return (
        <div className="min-h-screen bg-slate-950 p-4 sm:p-8 pb-32">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <BackButton />
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                Gestión de Campañas
                            </h1>
                            <p className="text-slate-400">
                                Control de paquetes de leads por asesor
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Campaña
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-64 rounded-3xl bg-white/5 animate-pulse border border-white/10"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {campaigns.map((campaign, index) => {
                            const progress =
                                (campaign.delivered_leads / campaign.total_leads) * 100

                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    key={campaign.id}
                                    className="glass-card p-6 border border-white/10 rounded-3xl flex flex-col gap-4 relative overflow-hidden group hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                                {campaign.name}
                                            </h3>
                                            <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                                                <Users className="w-3 h-3" />
                                                {campaign.advisor?.first_name}{' '}
                                                {campaign.advisor?.last_name}
                                            </p>
                                        </div>
                                        {campaign.active ? (
                                            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase border border-emerald-500/20">
                                                Activa
                                            </span>
                                        ) : (
                                            <span className="bg-slate-500/20 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-full uppercase border border-slate-500/20">
                                                Inactiva
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-3 mt-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Progreso de Entrega</span>
                                            <span className="text-white font-bold">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                                <Package className="w-3 h-3" /> Entregados
                                            </span>
                                            <span className="text-xl font-bold text-white">
                                                {campaign.delivered_leads}
                                            </span>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                                <Target className="w-3 h-3" /> Total
                                            </span>
                                            <span className="text-xl font-bold text-white">
                                                {campaign.total_leads}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-slate-500" />
                                            <span className="text-xs text-slate-400">
                                                Ritmo:{' '}
                                                <b className="text-white">{campaign.daily_rhythm}</b>{' '}
                                                leads/día
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">
                                            Restan:{' '}
                                            <b className="text-blue-400">{campaign.remaining_leads}</b>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {!loading && campaigns.length === 0 && (
                    <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-3xl">
                        <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No hay campañas registradas aún.</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-blue-400 mt-2 font-bold hover:underline"
                        >
                            Crea la primera campaña
                        </button>
                    </div>
                )}
            </div>

            <CampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadCampaigns}
            />
        </div>
    )
}
