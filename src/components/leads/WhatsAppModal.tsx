import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, Loader2, X, Phone, Mail, MapPin, Hash, User, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useWhatsAppMessage } from '@/hooks/useWhatsAppMessage'
import { logWhatsAppActivity } from '@/app/actions/lead-actions'

interface WhatsAppModalProps {
    isOpen: boolean
    onClose: () => void
    lead: {
        id: string
        first_name: string
        last_name: string
        phone: string
        email?: string
        dni?: string
        address_city?: string
        address_state?: string
        stage_name?: string
    }
    userName?: string
}

export const WhatsAppModal = ({ isOpen, onClose, lead, userName }: WhatsAppModalProps) => {
    const { generateLink } = useWhatsAppMessage()
    const [message, setMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        if (isOpen) {
            // Load template or default message
            const savedTemplate = localStorage.getItem('whatsapp_pending_template')
            const defaultMessage = `Hola [Nombre] 👋`

            let msg = savedTemplate || defaultMessage

            // Reemplazar variables
            msg = msg.replace(/\[Nombre\]/g, lead.first_name)
            msg = msg.replace(/\[Asesor\]/g, userName || 'tu asesor')

            setMessage(msg)

            // Bloquear scroll
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen, lead, userName])

    const handleSend = async () => {
        if (!message.trim()) return

        setIsSending(true)
        try {
            const whatsappUrl = generateLink(lead.phone, message)
            window.open(whatsappUrl, '_blank')

            const result = await logWhatsAppActivity(lead.id)

            if (result.success) {
                toast.success('WhatsApp abierto y actividad registrada')
                onClose()
            } else {
                toast.error(result.error || 'Error al registrar actividad')
            }
        } catch (error) {
            toast.error('Error inesperado al procesar el envío')
        } finally {
            setIsSending(false)
        }
    }

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
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
                        className="relative w-full sm:max-w-md overflow-hidden flex flex-col z-50 max-h-[90vh] glass-card rounded-t-3xl sm:rounded-3xl border border-white/20 bg-slate-900/95"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-green-500/20 text-green-400">
                                    <MessageCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-base">Enviar WhatsApp</h3>
                                    <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                                        {lead.first_name} {lead.last_name || '.'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-white/50 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-tighter px-1">Mensaje para enviar</label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Escribe tu mensaje..."
                                        className="w-full min-h-[160px] sm:min-h-[200px] p-4 rounded-2xl bg-white/5 text-slate-200 placeholder-slate-600 resize-none outline-none text-base sm:text-lg leading-relaxed font-medium border border-white/10 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-all custom-scrollbar"
                                        autoFocus
                                    />
                                </div>

                                {/* Contact Mini-Card */}
                                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-white/10 text-slate-400">
                                            <Phone className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{lead.phone}</p>
                                            {lead.email && <p className="text-[10px] text-slate-500 truncate">{lead.email}</p>}
                                        </div>
                                        {lead.dni && (
                                            <div className="px-2 py-1 rounded-md bg-white/5 border border-white/5">
                                                <p className="text-[9px] font-bold text-slate-400">DNI: {lead.dni}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(lead.address_city || lead.address_state) && (
                                        <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500 italic">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{lead.address_city}{lead.address_city && lead.address_state ? ', ' : ''}{lead.address_state}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 sm:p-6 bg-black/20 border-t border-white/10 flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isSending || !message.trim()}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00A859] hover:bg-[#008f4c] text-white font-bold shadow-lg shadow-green-900/40 transition-all transform active:scale-95 disabled:opacity-50 disabled:transform-none"
                            >
                                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                Enviar WhatsApp
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
