'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, User, Mail } from 'lucide-react'

interface ProfileCardProps {
    fullName: string | null
    email: string | null
}

export const ProfileCard = ({ fullName, email }: ProfileCardProps) => {
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas no coinciden')
            return
        }
        if (newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres')
            return
        }
        setIsLoading(true)
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
            toast.error('Error al cambiar la contraseña: ' + error.message)
        } else {
            toast.success('Contraseña actualizada correctamente')
            setNewPassword('')
            setConfirmPassword('')
        }
        setIsLoading(false)
    }

    const initial = fullName ? fullName.charAt(0).toUpperCase() : email ? email.charAt(0).toUpperCase() : 'U'

    return (
        <div className="space-y-6">
            {/* Datos del perfil */}
            <div className="glass-card p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20 shrink-0">
                        {initial}
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{fullName || 'Sin nombre'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Nombre completo</label>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{fullName || '—'}</span>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Email</label>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{email || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cambiar contraseña */}
            <div className="glass-card p-6 rounded-2xl space-y-5">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10">
                        <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Cambiar contraseña</h3>
                </div>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">
                                Nueva contraseña
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">
                                Confirmar contraseña
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repetir contraseña"
                                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !newPassword || !confirmPassword}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {isLoading ? 'Actualizando...' : 'Actualizar contraseña'}
                    </button>
                </form>
            </div>
        </div>
    )
}
