'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, Loader2, X, MessageSquare, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { addLeadComment, getLeadActivities } from '@/app/actions/lead-actions'

interface Activity {
    id: string
    type: string
    content: string
    created_at: string
}

interface LeadCommentsModalProps {
    isOpen: boolean
    onClose: () => void
    leadId: string
    leadName: string
}

export const LeadCommentsModal = ({ isOpen, onClose, leadId, leadName }: LeadCommentsModalProps) => {
    const [comment, setComment] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [activities, setActivities] = useState<Activity[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        if (isOpen) {
            fetchActivities()
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen, leadId])

    const fetchActivities = async () => {
        setIsLoading(true)
        try {
            const data = await getLeadActivities(leadId)
            setActivities(data)
        } catch (error) {
            console.error('Error fetching activities:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddComment = async () => {
        if (!comment.trim()) return

        setIsSaving(true)
        try {
            const result = await addLeadComment(leadId, comment)
            if (result.success) {
                toast.success('Comentario agregado correctamente')
                setComment('')
                fetchActivities()
            } else {
                toast.error(result.error || 'Error al agregar comentario')
            }
        } catch (error) {
            toast.error('Error inesperado al guardar el comentario')
        } finally {
            setIsSaving(false)
        }
    }

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full sm:max-w-lg overflow-hidden flex flex-col z-50 max-h-[90vh] glass-card rounded-t-3xl sm:rounded-3xl border border-white/20 bg-slate-900/95 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">Comentarios</h3>
                                    <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                                        Prospecto: {leadName}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Activities List */}
                        <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-black/20 min-h-[300px]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50 py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                                    <p className="text-sm font-medium text-slate-400">Cargando historial...</p>
                                </div>
                            ) : activities.length > 0 ? (
                                <div className="space-y-4">
                                    {activities.map((activity) => (
                                        <div key={activity.id} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                                            <div className={`p-4 rounded-2xl border ${activity.type === 'comment'
                                                ? 'bg-white/5 border-white/10'
                                                : 'bg-green-500/5 border-green-500/10'
                                                } transition-all hover:bg-white/10`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${activity.type === 'comment' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                                            {activity.type === 'comment' ? <User className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {activity.type === 'comment' ? 'Nota' : 'WhatsApp'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(activity.created_at).toLocaleString('es-AR', {
                                                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-200 leading-relaxed">
                                                    {activity.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20">
                                    <div className="p-4 rounded-full bg-white/5 border border-white/10">
                                        <MessageSquare className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-400">No hay comentarios aún</p>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-5 bg-slate-900 border-t border-white/10 space-y-4">
                            <div className="relative">
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Escribe una nota interna para este prospecto..."
                                    className="w-full min-h-[100px] p-4 rounded-2xl bg-white/5 text-slate-200 placeholder-slate-600 resize-none outline-none text-sm leading-relaxed border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all custom-scrollbar"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handleAddComment}
                                    disabled={isSaving || !comment.trim()}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/40 transition-all transform active:scale-95 disabled:opacity-50 disabled:transform-none"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    Guardar Comentario
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
