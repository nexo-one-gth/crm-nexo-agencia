'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface SimpleModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
}

export const SimpleModal = ({ isOpen, onClose, title, children }: SimpleModalProps) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
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
                        className="relative w-full sm:max-w-lg glass-card overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col"
                    >
                        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                            {/* Mobile drag indicator */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 sm:hidden" />
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 sm:mt-0">{title}</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar safe-bottom">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
