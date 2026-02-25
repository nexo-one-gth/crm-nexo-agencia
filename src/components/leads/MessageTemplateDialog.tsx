'use client'

import { useState, useEffect } from 'react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import { Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface MessageTemplateDialogProps {
    isOpen: boolean
    onClose: () => void
    stageName?: string
}

const DEFAULT_TEMPLATE = "Hola [Nombre] 👋"

const STAGE_LABELS: Record<string, string> = {
    'Pendiente': 'Pendiente',
    'Contactado': 'Contactado',
    'Interesado': 'Interesado',
}

const getStorageKey = (stageName: string): string => {
    const normalized = stageName.toLowerCase().replace(/\s+/g, '_')
    return `whatsapp_template_${normalized}`
}

export const MessageTemplateDialog = ({ isOpen, onClose, stageName = 'Pendiente' }: MessageTemplateDialogProps) => {
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE)

    useEffect(() => {
        if (isOpen) {
            const stageKey = getStorageKey(stageName)
            let saved = localStorage.getItem(stageKey)

            // Retrocompatibilidad: migrar key vieja para "Pendiente"
            if (!saved && stageName === 'Pendiente') {
                const legacy = localStorage.getItem('whatsapp_pending_template')
                if (legacy) {
                    saved = legacy
                    localStorage.setItem(stageKey, legacy)
                }
            }

            setTemplate(saved || DEFAULT_TEMPLATE)
        }
    }, [isOpen, stageName])

    const handleSave = () => {
        if (!template.trim()) {
            toast.error('El mensaje no puede estar vacío')
            return
        }
        const stageKey = getStorageKey(stageName)
        localStorage.setItem(stageKey, template)
        // Mantener la key legacy sincronizada para Pendiente
        if (stageName === 'Pendiente') {
            localStorage.setItem('whatsapp_pending_template', template)
        }
        toast.success('Plantilla guardada correctamente')
        onClose()
    }

    const handleReset = () => {
        setTemplate(DEFAULT_TEMPLATE)
        toast.info('Plantilla restablecida al valor original')
    }

    const stageLabel = STAGE_LABELS[stageName] || stageName

    return (
        <SimpleModal isOpen={isOpen} onClose={onClose} title="Configurar Mensaje Inicial">
            <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
                    <p className="font-bold mb-1">Variables Disponibles:</p>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li><code>[Nombre]</code>: Nombre del prospecto</li>
                        <li><code>[Asesor]</code>: Tu nombre (o &quot;tu asesor&quot;)</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Mensaje para &quot;{stageLabel}&quot;
                    </label>
                    <textarea
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        placeholder="Escribe el mensaje predeterminado..."
                        className="w-full min-h-[150px] p-4 text-sm bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 rounded-xl resize-none outline-none transition-all placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        title="Restablecer original"
                    >
                        <RefreshCw className="w-3 h-3" /> Restablecer
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-lg shadow-amber-500/20 transition-all"
                        >
                            <Save className="w-4 h-4" />
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </SimpleModal>
    )
}
