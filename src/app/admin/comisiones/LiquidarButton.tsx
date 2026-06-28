'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { marcarComisionLiquidada } from '@/app/actions/prepaga-actions'
import { CheckCircle2 } from 'lucide-react'

export function LiquidarButton({ comisionId }: { comisionId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const res = await marcarComisionLiquidada(comisionId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Comisión marcada como liquidada')
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shrink-0"
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
      Marcar liquidada
    </button>
  )
}
