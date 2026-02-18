'use client'

import { useState } from 'react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import { FileUp, Loader2, CheckCircle2, AlertCircle, XCircle, Download } from 'lucide-react'
import { importLeadsAction } from '@/app/actions/import-leads'
import { toast } from 'sonner'

interface ImportLeadsDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const ImportLeadsDialog = ({ isOpen, onClose, onSuccess }: ImportLeadsDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<{ imported: number; failed: number; errors: any[] } | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setResult(null)

        const formData = new FormData(e.currentTarget)
        const res = await importLeadsAction(formData)

        if (res.success && res.data) {
            setResult(res.data)
            if (res.data.imported > 0) {
                toast.success(`Se importaron ${res.data.imported} leads correctamente`)
                onSuccess()
            }
            if (res.data.failed > 0) {
                toast.warning(`${res.data.failed} fila(s) no pudieron importarse`)
            }
        } else {
            // Error total (ej. archivo inválido, sin autenticación)
            setResult({ imported: 0, failed: 1, errors: [{ row: '-', error: res.error || 'Error desconocido' }] })
        }
        setIsSubmitting(false)
    }

    const downloadTemplate = () => {
        const headers = 'NOMBRE,DNI,PROVINCIA,LOCALIDAD,CELULAR,MAIL'
        const blob = new Blob([headers], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'plantilla_leads.csv'
        a.click()
    }

    return (
        <SimpleModal
            isOpen={isOpen}
            onClose={() => {
                onClose()
                setResult(null)
            }}
            title="Importar Leads (Excel/CSV)"
        >
            <div className="p-6 space-y-6">
                {!result ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Archivo de Leads</label>
                            <div className="relative group">
                                <input
                                    name="file"
                                    type="file"
                                    accept=".csv, .xlsx, .xls"
                                    required
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group-hover:border-blue-500/50"
                                >
                                    <FileUp className="w-10 h-10 text-slate-400 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                        Selecciona un archivo .csv o .xlsx
                                    </span>
                                    <span className="text-[10px] text-slate-500 mt-2">
                                        Máximo 5MB
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Importante:
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Los leads importados se cargarán sin asesor asignado en la etapa &quot;Pendiente de Asignación&quot;.
                            </p>
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 mt-2"
                            >
                                <Download className="w-3 h-3" /> Descargar Plantilla CSV
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <FileUp className="w-5 h-5" />
                            )}
                            {isSubmitting ? 'Procesando...' : 'Comenzar Importación'}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-6 text-center animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center gap-2">
                            {result.imported > 0 ? (
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <XCircle className="w-10 h-10 text-red-500" />
                                </div>
                            )}
                            <h3 className="text-xl font-bold">
                                {result.imported > 0 ? 'Importación Finalizada' : 'Error en la Importación'}
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Exitosos</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                <p className="text-2xl font-bold text-amber-600">{result.failed}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Fallidos</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div className="max-h-32 overflow-y-auto text-left space-y-1 p-2 rounded-lg bg-black/5 dark:bg-black/20 text-[10px] font-mono">
                                {result.errors.map((err, i) => (
                                    <p key={i} className="text-amber-600 dark:text-amber-400">
                                        Fila {err.row}: {err.error}
                                    </p>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => {
                                onClose()
                                setResult(null)
                            }}
                            className="w-full py-3.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white font-bold"
                        >
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </SimpleModal>
    )
}
