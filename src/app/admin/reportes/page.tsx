import { ReporteLeadsAsignados } from '@/components/admin/ReporteLeadsAsignados'
import { BarChart3 } from 'lucide-react'

export default function ReportesPage() {
    return (
        <div className="max-w-6xl mx-auto py-8 space-y-6">
            <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 shrink-0">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Reportes</h1>
                    <p className="text-xs text-slate-500">Asignación de leads por asesor y por día</p>
                </div>
            </div>
            <ReporteLeadsAsignados />
        </div>
    )
}
