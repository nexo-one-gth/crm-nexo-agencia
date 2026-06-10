'use client'

import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface AlertDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
}

export const AlertDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
}: AlertDialogProps) => {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        if (isOpen) {
            document.addEventListener('keydown', handleKey)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div className="relative z-10 w-full max-w-sm animate-in zoom-in-95 duration-200">
                <div className="rounded-2xl p-6 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="mt-5 flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-all"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={() => { onConfirm(); onClose() }}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-lg shadow-rose-500/20"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
