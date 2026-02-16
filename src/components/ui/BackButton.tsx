'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export const BackButton = () => {
    const router = useRouter()

    return (
        <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-md bg-white/10 dark:bg-black/20 border border-white/20 hover:bg-white/20 dark:hover:bg-black/30 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-6"
            title="Volver"
        >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium text-sm">Volver</span>
        </button>
    )
}
