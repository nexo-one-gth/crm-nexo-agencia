'use client'

import { useState, useEffect } from 'react'
import { createAdvisor, getAdvisors, type ActionResponse } from '@/app/actions/advisor-actions'
import { toast } from 'sonner'
import { UserPlus, Users, Loader2, Shield, Mail, Target } from 'lucide-react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import Link from 'next/link'

export const AdminAdvisorView = () => {
    const [advisors, setAdvisors] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchAdvisors = async () => {
        setIsLoading(true)
        const res = await getAdvisors()
        if (res.success) {
            setAdvisors(res.data || [])
        } else {
            toast.error("Error al cargar asesores: " + res.error)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchAdvisors()
    }, [])

    const handleCreateAdvisor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)

        const formData = new FormData(e.currentTarget)
        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            role: formData.get('role') as any
        }

        const res = await createAdvisor(data)
        if (res.success) {
            toast.success("Asesor creado correctamente")
            setIsCreateModalOpen(false)
            fetchAdvisors()
        } else {
            toast.error("Error: " + res.error)
        }
        setIsSubmitting(false)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Gestión de Equipo</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Crea y administra los perfiles de tus asesores</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/admin/campaigns"
                        className="w-full sm:w-auto px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-slate-900 dark:text-white rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all shadow-lg font-bold active:scale-95"
                    >
                        <Target className="w-4 h-4" />
                        Gestionar Campañas
                    </Link>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg font-bold active:scale-95"
                    >
                        <UserPlus className="w-4 h-4" />
                        Nuevo Asesor
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    </div>
                ) : advisors.length > 0 ? (
                    advisors.map((advisor) => (
                        <div key={advisor.id} className="glass-card p-6 rounded-2xl space-y-4 hover:border-white/40 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 flex items-center justify-center">
                                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {advisor.first_name?.[0]}{advisor.last_name?.[0]}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">
                                        {advisor.first_name} {advisor.last_name}
                                    </h3>
                                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${advisor.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                                        {advisor.role}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                                <p className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    {advisor.email}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center glass-card rounded-2xl border-dashed">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No hay asesores registrados aún.</p>
                    </div>
                )}
            </div>

            <SimpleModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Registrar Nuevo Miembro"
            >
                <form onSubmit={handleCreateAdvisor} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Nombre</label>
                            <input name="firstName" required className="w-full px-4 py-2.5 rounded-xl glass-input border border-white/20" placeholder="Ej: Juan" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Apellido</label>
                            <input name="lastName" required className="w-full px-4 py-2.5 rounded-xl glass-input border border-white/20" placeholder="Ej: Pérez" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500 ml-1">Email</label>
                        <input name="email" type="email" required className="w-full px-4 py-2.5 rounded-xl glass-input border border-white/20" placeholder="asesor@nexo.com" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500 ml-1">Contraseña</label>
                        <input name="password" type="password" required className="w-full px-4 py-2.5 rounded-xl glass-input border border-white/20" placeholder="••••••••" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500 ml-1">Rol</label>
                        <select name="role" className="w-full px-4 py-2.5 rounded-xl glass-input border border-white/20 appearance-none bg-transparent">
                            <option value="asesor">Asesor de Ventas</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                        {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                    </button>
                </form>
            </SimpleModal>
        </div>
    )
}
