import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Send, Loader2, X, Phone, Mail, MapPin, Hash, User } from 'lucide-react'
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
            const defaultMessage = `Hola [Nombre], soy [Asesor] de Nexo Seguros. Te contacto porque tenemos una propuesta que puede interesarte. ¿Tenés unos minutos?`

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
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
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
                        className="relative w-full sm:max-w-sm overflow-hidden flex flex-col z-50 max-h-[95vh] sm:max-h-[90vh]"
                    >
                        {/* Mobile drag indicator */}
                        <div className="flex justify-center pt-2 pb-0 sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-white/30" />
                        </div>

                        {/* Area de Mensaje (Top - Dark) */}
                        <div className="flex-1 bg-slate-900 rounded-t-3xl sm:rounded-t-3xl rounded-b-[2.5rem] p-4 sm:p-6 pb-28 sm:pb-32 shadow-2xl border border-slate-700/50 relative z-10">
                            <div className="flex justify-between items-start mb-3 sm:mb-4">
                                <h3 className="text-white font-bold text-lg sm:text-xl">Mensaje</h3>
                                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
                                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Escribe tu mensaje..."
                                className="w-full h-full min-h-[150px] sm:min-h-[200px] bg-transparent text-slate-200 placeholder-slate-600 resize-none outline-none text-base sm:text-lg leading-relaxed font-medium custom-scrollbar"
                                autoFocus
                            />
                        </div>

                        {/* Overlay Glass (Bottom) */}
                        <div className="absolute bottom-0 left-0 right-0 z-20 safe-bottom">
                            <div className="glass-card mx-2 mb-2 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-5 shadow-2xl border border-white/20 backdrop-blur-xl bg-black/40">
                                {/* Lead Info */}
                                <div className="mb-4 sm:mb-6 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide truncate mr-2">
                                            {lead.first_name} <span className="text-slate-400">{lead.last_name || '.'}</span>
                                        </h2>
                                        <div className="p-2 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
                                            <Phone className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-400">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            <Phone className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{lead.phone}</span>
                                        </div>
                                        {lead.dni && (
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                <Hash className="w-3 h-3 shrink-0" />
                                                <span className="truncate">DNI: {lead.dni}</span>
                                            </div>
                                        )}
                                        {lead.email && (
                                            <div className="flex items-center gap-1.5 overflow-hidden col-span-2">
                                                <Mail className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{lead.email}</span>
                                            </div>
                                        )}
                                        {(lead.address_city || lead.address_state) && (
                                            <div className="flex items-center gap-1.5 overflow-hidden col-span-2 italic text-slate-500">
                                                <MapPin className="w-3 h-3 shrink-0" />
                                                <span className="truncate uppercase">
                                                    {lead.address_city}{lead.address_city && lead.address_state ? ', ' : ''}{lead.address_state}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 sm:gap-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 sm:px-6 py-3 rounded-xl text-sm font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={isSending || !message.trim()}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00A859] hover:bg-[#008f4c] text-white font-bold shadow-lg shadow-[#00A859]/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:transform-none"
                                    >
                                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        Enviar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
