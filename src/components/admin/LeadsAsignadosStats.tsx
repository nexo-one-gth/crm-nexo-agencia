'use client'

import { useState, useEffect, useCallback } from 'react'
import { getLeadsAsignadosPorFecha, type LeadsAsignadosStat } from '@/app/actions/advisor-actions'
import { toast } from 'sonner'
import { Loader2, CalendarRange, UserCheck } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'

const hoy = () => format(new Date(), 'yyyy-MM-dd')
const inicioDeMes = () => format(startOfMonth(new Date()), 'yyyy-MM-dd')

export const LeadsAsignadosStats = () => {
    const [desde, setDesde] = useState(inicioDeMes)
    const [hasta, setHasta] = useState(hoy)
    const [stats, setStats] = useState<LeadsAsignadosStat[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    const fetchStats = useCallback(async (d: string, h: string) => {
        setIsLoading(true)
        const res = await getLeadsAsignadosPorFecha(d, h)
        if (res.success && res.data) {
            setStats(res.data.stats)
            setTotal(res.data.total)
        } else {
            toast.error('Error al cargar estadísticas: ' + res.error)
        }
        setIsLoading(false)
    }, [])

    useEffect(() => {
        if (!desde || !hasta || desde > hasta) return
        fetchStats(desde, hasta)
    }, [desde, hasta, fetchStats])

    const maxCount = stats.length > 0 ? stats[0].count : 0

    return (
        <div className="glass-card rounded-2xl p-5 space-y-4">
            {/* Header + rango de fechas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 shrink-0">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Leads asignados</h3>
                        <p className="text-[11px] text-slate-500">Por asesor en el período seleccionado</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <CalendarRange className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        type="date"
                        value={desde}
                        max={hasta}
                        onChange={e => setDesde(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl glass-input text-xs"
                        aria-label="Desde"
                    />
                    <span className="text-xs text-slate-400">→</span>
                    <input
                        type="date"
                        value={hasta}
                        min={desde}
                        onChange={e => setHasta(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl glass-input text-xs"
                        aria-label="Hasta"
                    />
                </div>
            </div>

            {/* Resultados */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
            ) : stats.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">
                    No hay leads asignados en este período
                </p>
            ) : (
                <div className="space-y-2">
                    {stats.map(s => (
                        <div key={s.asesor_id} className="flex items-center gap-3">
                            <p className="w-36 sm:w-44 text-sm font-semibold text-slate-800 dark:text-slate-200 truncate shrink-0" title={s.email ?? undefined}>
                                {s.nombre}
                            </p>
                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${maxCount > 0 ? (s.count / maxCount) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="w-10 text-right text-sm font-bold text-slate-900 dark:text-white shrink-0">
                                {s.count}
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{total}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
