'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getLeadsAsignadosPorFecha,
    getLeadsAsignadosPorDiaDeAsesor,
    type LeadsAsignadosStat,
    type LeadsAsignadosPorDia,
} from '@/app/actions/advisor-actions'
import { toast } from 'sonner'
import { Loader2, CalendarRange, UserCheck, ArrowLeft, CalendarDays } from 'lucide-react'
import { format, startOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const hoy = () => format(new Date(), 'yyyy-MM-dd')
const inicioDeMes = () => format(startOfMonth(new Date()), 'yyyy-MM-dd')

const formatDia = (fecha: string) => {
    try {
        return format(parseISO(fecha), "EEEE d 'de' MMM", { locale: es })
    } catch {
        return fecha
    }
}

export const ReporteLeadsAsignados = () => {
    const [desde, setDesde] = useState(inicioDeMes)
    const [hasta, setHasta] = useState(hoy)

    // Vista general (por asesor)
    const [stats, setStats] = useState<LeadsAsignadosStat[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    // Filtro por asesor + desglose diario
    const [asesorId, setAsesorId] = useState<string>('')
    const [dias, setDias] = useState<LeadsAsignadosPorDia[]>([])
    const [totalDias, setTotalDias] = useState(0)
    const [nombreAsesor, setNombreAsesor] = useState('')
    const [isLoadingDias, setIsLoadingDias] = useState(false)

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

    const fetchDias = useCallback(async (id: string, d: string, h: string) => {
        setIsLoadingDias(true)
        const res = await getLeadsAsignadosPorDiaDeAsesor(id, d, h)
        if (res.success && res.data) {
            setDias(res.data.dias)
            setTotalDias(res.data.total)
            setNombreAsesor(res.data.nombre)
        } else {
            toast.error('Error al cargar el desglose: ' + res.error)
            setDias([])
            setTotalDias(0)
        }
        setIsLoadingDias(false)
    }, [])

    useEffect(() => {
        if (!desde || !hasta || desde > hasta) return
        fetchStats(desde, hasta)
    }, [desde, hasta, fetchStats])

    useEffect(() => {
        if (!asesorId || !desde || !hasta || desde > hasta) return
        fetchDias(asesorId, desde, hasta)
    }, [asesorId, desde, hasta, fetchDias])

    const maxCount = stats.length > 0 ? Math.max(...stats.map(s => s.count)) : 0
    const maxDia = dias.length > 0 ? Math.max(...dias.map(d => d.count)) : 0

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
                        <p className="text-[11px] text-slate-500">
                            {asesorId ? 'Asignación diaria del asesor' : 'Por asesor en el período seleccionado'}
                        </p>
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

            {/* Selector de asesor */}
            <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                    Asesor
                </label>
                <select
                    value={asesorId}
                    onChange={e => setAsesorId(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl glass-input text-xs"
                    aria-label="Filtrar por asesor"
                >
                    <option value="">Todos los asesores</option>
                    {stats.map(s => (
                        <option key={s.asesor_id} value={s.asesor_id}>
                            {s.nombre} ({s.count})
                        </option>
                    ))}
                </select>
                {asesorId && (
                    <button
                        onClick={() => setAsesorId('')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-button text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver
                    </button>
                )}
            </div>

            {/* --- VISTA DESGLOSE DIARIO (asesor seleccionado) --- */}
            {asesorId ? (
                isLoadingDias ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                ) : dias.length === 0 ? (
                    <p className="text-[12px] text-slate-400 text-center py-6">
                        {nombreAsesor || 'Este asesor'} no tiene leads asignados en este período
                    </p>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 pb-1">
                            <CalendarDays className="w-4 h-4 text-purple-500 shrink-0" />
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                {nombreAsesor}
                            </p>
                        </div>
                        {dias.map(d => (
                            <div key={d.fecha} className="flex items-center gap-3">
                                <p className="w-36 sm:w-44 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize truncate shrink-0">
                                    {formatDia(d.fecha)}
                                </p>
                                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                        style={{ width: `${maxDia > 0 ? (d.count / maxDia) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="w-10 text-right text-sm font-bold text-slate-900 dark:text-white shrink-0">
                                    {d.count}
                                </span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{totalDias}</p>
                        </div>
                    </div>
                )
            ) : /* --- VISTA GENERAL (por asesor) --- */
            isLoading ? (
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
                        <button
                            key={s.asesor_id}
                            onClick={() => setAsesorId(s.asesor_id)}
                            className="w-full flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-white/5 transition-colors text-left"
                            title="Ver desglose diario"
                        >
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
                        </button>
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
