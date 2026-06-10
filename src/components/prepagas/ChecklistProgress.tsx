import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistProgressProps {
  totalRequeridos: number
  completados: number
  totalItems: number
  showDetail?: boolean
  size?: 'sm' | 'md'
}

export function ChecklistProgress({
  totalRequeridos,
  completados,
  totalItems,
  showDetail = true,
  size = 'md',
}: ChecklistProgressProps) {
  const pct = totalRequeridos > 0 ? Math.round((completados / totalRequeridos) * 100) : 0
  const completo = pct === 100

  const colorBar = completo
    ? 'bg-emerald-500'
    : pct >= 60
    ? 'bg-blue-500'
    : pct >= 30
    ? 'bg-amber-500'
    : 'bg-slate-300 dark:bg-slate-600'

  return (
    <div className="space-y-1.5">
      {showDetail && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {completo ? (
              <CheckCircle2 className={cn('text-emerald-500', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
            ) : (
              <Circle className={cn('text-slate-400', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
            )}
            <span className={cn('font-semibold', completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300', size === 'sm' ? 'text-xs' : 'text-sm')}>
              {completo ? 'Completo' : `${completados}/${totalRequeridos} requeridos`}
            </span>
          </div>
          <span className={cn('font-bold tabular-nums', completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {pct}%
          </span>
        </div>
      )}

      <div className={cn('w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorBar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {showDetail && totalItems > totalRequeridos && (
        <p className="text-xs text-slate-400">
          {totalItems - totalRequeridos} ítems opcionales
        </p>
      )}
    </div>
  )
}
