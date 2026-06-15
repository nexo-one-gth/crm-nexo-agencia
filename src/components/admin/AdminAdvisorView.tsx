'use client'

import { useState, useEffect, useRef } from 'react'
import {
    createAdvisor, getAdminsConAsesores, toggleAparecer,
    getPrepagasDeAsesor, getAllPrepagasParaAsignar,
    asignarAsesorAAdmin, desasignarAsesorDeAdmin, actualizarCodigoProductor
} from '@/app/actions/advisor-actions'
import { asignarAsesor, desasignarAsesor } from '@/app/actions/prepaga-actions'
import { toast } from 'sonner'
import {
    UserPlus, Loader2, Mail, Target,
    X, Shield, ChevronRight, Plus, Check, Trash2, ChevronDown, Users, Hash
} from 'lucide-react'
import { SimpleModal } from '@/components/ui/SimpleModal'
import Link from 'next/link'

type Profile = {
    id: string
    first_name: string | null
    last_name: string | null
    role: string
    email: string | null
    aparecer_en_tablero: boolean
    codigo_productor: string | null
}

type Assignment = { admin_id: string; asesor_id: string }

type PrepagaAsignada = {
    id: string
    prepaga_id: string
    asesor_id: string
    comision_pct: number | null
    codigo_productor: string | null
    activo: boolean
    prepagas: { id: string; nombre: string; slug: string } | null
}

type Prepaga = { id: string; nombre: string; slug: string }

const profileName = (p: Profile) => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
const initials = (p: Profile) => `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase()

export const AdminAdvisorView = () => {
    const [admins, setAdmins] = useState<Profile[]>([])
    const [asesores, setAsesores] = useState<Profile[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Panel detalle
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
    const [prepagasAsesor, setPrepagasAsesor] = useState<PrepagaAsignada[]>([])
    const [allPrepagas, setAllPrepagas] = useState<Prepaga[]>([])
    const [isLoadingDetail, setIsLoadingDetail] = useState(false)
    const [isAddingPrepaga, setIsAddingPrepaga] = useState(false)
    const [addForm, setAddForm] = useState({ prepaga_id: '', comision_pct: '' })
    const [isSavingPrepaga, setIsSavingPrepaga] = useState(false)
    const [isTogglingTablero, setIsTogglingTablero] = useState(false)
    const [codigoEdit, setCodigoEdit] = useState('')
    const [isSavingCodigo, setIsSavingCodigo] = useState(false)

    const fetchData = async () => {
        setIsLoading(true)
        const res = await getAdminsConAsesores()
        if (res.success && res.data) {
            setAdmins(res.data.admins)
            setAsesores(res.data.asesores)
            setAssignments(res.data.assignments)
        } else {
            toast.error('Error al cargar usuarios: ' + res.error)
        }
        setIsLoading(false)
    }

    useEffect(() => { fetchData() }, [])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdown(null)
            }
        }
        if (openDropdown) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [openDropdown])

    const openDetail = async (profile: Profile) => {
        setSelectedProfile(profile)
        setIsAddingPrepaga(false)
        setAddForm({ prepaga_id: '', comision_pct: '' })
        setCodigoEdit(profile.codigo_productor ?? '')
        setIsLoadingDetail(true)
        const [prepRes, todasRes] = await Promise.all([
            getPrepagasDeAsesor(profile.id),
            getAllPrepagasParaAsignar()
        ])
        setPrepagasAsesor(prepRes as PrepagaAsignada[])
        setAllPrepagas(todasRes as Prepaga[])
        setIsLoadingDetail(false)
    }

    const handleToggleTablero = async (value: boolean) => {
        if (!selectedProfile || isTogglingTablero) return
        setIsTogglingTablero(true)
        const res = await toggleAparecer(selectedProfile.id, value)
        if (res.success) {
            const updated = { ...selectedProfile, aparecer_en_tablero: value }
            setSelectedProfile(updated)
            setAdmins(prev => prev.map(a => a.id === selectedProfile.id ? updated : a))
            setAsesores(prev => prev.map(a => a.id === selectedProfile.id ? updated : a))
            toast.success(value ? 'Aparece en tablero activado' : 'Desactivado del tablero')
        } else {
            toast.error('Error: ' + res.error)
        }
        setIsTogglingTablero(false)
    }

    const reloadPrepagas = async () => {
        if (!selectedProfile) return
        const res = await getPrepagasDeAsesor(selectedProfile.id)
        setPrepagasAsesor(res as PrepagaAsignada[])
    }

    const handleAsignarPrepaga = async () => {
        if (!selectedProfile || !addForm.prepaga_id) return
        setIsSavingPrepaga(true)
        const res = await asignarAsesor({
            prepaga_id: addForm.prepaga_id,
            asesor_id: selectedProfile.id,
            comision_pct: addForm.comision_pct ? parseFloat(addForm.comision_pct) : null,
        })
        if ('error' in res && res.error) {
            toast.error('Error: ' + res.error)
        } else {
            toast.success('Prepaga asignada')
            await reloadPrepagas()
            setAddForm({ prepaga_id: '', comision_pct: '' })
            setIsAddingPrepaga(false)
        }
        setIsSavingPrepaga(false)
    }

    const handleSaveCodigo = async () => {
        if (!selectedProfile || isSavingCodigo) return
        setIsSavingCodigo(true)
        const res = await actualizarCodigoProductor(selectedProfile.id, codigoEdit.trim() || null)
        if (res.success) {
            const updated = { ...selectedProfile, codigo_productor: codigoEdit.trim() || null }
            setSelectedProfile(updated)
            setAsesores(prev => prev.map(a => a.id === selectedProfile.id ? updated : a))
            toast.success('Código guardado')
        } else {
            toast.error('Error: ' + res.error)
        }
        setIsSavingCodigo(false)
    }

    const handleDesasignar = async (prepagaId: string) => {
        if (!selectedProfile) return
        const res = await desasignarAsesor(prepagaId, selectedProfile.id)
        if ('error' in res && res.error) {
            toast.error('Error: ' + res.error)
        } else {
            setPrepagasAsesor(prev => prev.filter(p => p.prepaga_id !== prepagaId))
            toast.success('Prepaga removida')
        }
    }

    const handleAsignarAAdmin = async (adminId: string, asesorId: string) => {
        setOpenDropdown(null)
        const res = await asignarAsesorAAdmin(adminId, asesorId)
        if (res.success) {
            setAssignments(prev => [...prev, { admin_id: adminId, asesor_id: asesorId }])
            toast.success('Asesor asignado al grupo')
        } else {
            toast.error('Error: ' + res.error)
        }
    }

    const handleDesasignarDeAdmin = async (adminId: string, asesorId: string) => {
        const res = await desasignarAsesorDeAdmin(adminId, asesorId)
        if (res.success) {
            setAssignments(prev => prev.filter(a => !(a.admin_id === adminId && a.asesor_id === asesorId)))
            toast.success('Asesor removido del grupo')
        } else {
            toast.error('Error: ' + res.error)
        }
    }

    const handleCreateAdvisor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        const formData = new FormData(e.currentTarget)
        const res = await createAdvisor({
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            role: formData.get('role') as 'admin' | 'asesor',
        })
        if (res.success) {
            toast.success('Usuario creado correctamente')
            setIsCreateModalOpen(false)
            fetchData()
        } else {
            toast.error('Error: ' + res.error)
        }
        setIsSubmitting(false)
    }

    const getAsesoresDeAdmin = (adminId: string) =>
        asesores.filter(a => assignments.some(ass => ass.admin_id === adminId && ass.asesor_id === a.id))

    const unassignedAsesores = asesores.filter(a => !assignments.some(ass => ass.asesor_id === a.id))

    const getDisponiblesParaAdmin = (adminId: string) =>
        asesores.filter(a =>
            !assignments.some(ass => ass.asesor_id === a.id)
        ).filter(a => !assignments.some(ass => ass.admin_id === adminId && ass.asesor_id === a.id))

    const availablePrepagas = allPrepagas.filter(p => !prepagasAsesor.some(pa => pa.prepaga_id === p.id))

    return (
        <div className="space-y-6 animate-in fade-in duration-700">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Equipo de Asesores</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Administrá la estructura del equipo y las prepagas asignadas
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/admin/campaigns"
                        className="px-4 py-2 glass-button rounded-xl text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300"
                    >
                        <Target className="w-4 h-4" />
                        Campañas
                    </Link>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                        <UserPlus className="w-4 h-4" />
                        Nuevo Asesor
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="space-y-4">

                    {/* Grupos por admin */}
                    {admins.map(admin => {
                        const grupoAsesores = getAsesoresDeAdmin(admin.id)
                        const disponibles = getDisponiblesParaAdmin(admin.id)
                        const isDropdownOpen = openDropdown === admin.id

                        return (
                            <div key={admin.id} className="glass-card rounded-2xl" style={isDropdownOpen ? { position: 'relative', zIndex: 50 } : undefined}>
                                {/* Admin header */}
                                <div className="flex items-center gap-3 p-4 border-b border-white/5 rounded-t-2xl">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-purple-300">{initials(admin)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white truncate text-sm">
                                            {profileName(admin)}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                            <Mail className="w-3 h-3 shrink-0" />
                                            {admin.email}
                                        </p>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 shrink-0">
                                        ADMIN
                                    </span>
                                    <button
                                        onClick={() => openDetail(admin)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors shrink-0"
                                        title="Ver detalle"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Asesores del grupo */}
                                <div className="px-4 py-3 space-y-1.5">
                                    {grupoAsesores.map(asesor => (
                                        <div
                                            key={asesor.id}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 group/row"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border border-blue-500/20 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-blue-300">{initials(asesor)}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                    {profileName(asesor)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => openDetail(asesor)}
                                                className="p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors opacity-0 group-hover/row:opacity-100"
                                                title="Ver detalle"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDesasignarDeAdmin(admin.id, asesor.id)}
                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover/row:opacity-100"
                                                title="Quitar del grupo"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Botón asignar asesor */}
                                    {disponibles.length > 0 && (
                                        <div
                                            className="relative mt-1"
                                            ref={isDropdownOpen ? dropdownRef : undefined}
                                        >
                                            <button
                                                onClick={() => setOpenDropdown(isDropdownOpen ? null : admin.id)}
                                                className="flex items-center gap-1.5 text-[12px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors px-1 py-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Asignar asesor
                                                <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isDropdownOpen && (
                                                <div className="absolute left-0 top-full mt-1 z-[100] min-w-[200px] rounded-xl bg-slate-800 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                                                    <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/5">
                                                        Sin asignar ({disponibles.length})
                                                    </p>
                                                    <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                                                        {disponibles.map(a => (
                                                            <button
                                                                key={a.id}
                                                                onClick={() => handleAsignarAAdmin(admin.id, a.id)}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors text-left"
                                                            >
                                                                <div className="w-6 h-6 rounded-full bg-blue-900/60 flex items-center justify-center shrink-0">
                                                                    <span className="text-[9px] font-bold text-blue-300">{initials(a)}</span>
                                                                </div>
                                                                <span className="truncate">{profileName(a)}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {grupoAsesores.length === 0 && disponibles.length === 0 && (
                                        <p className="text-[11px] text-slate-500 py-1 px-1">
                                            Todos los asesores ya están asignados a un grupo
                                        </p>
                                    )}

                                    {grupoAsesores.length === 0 && disponibles.length > 0 && (
                                        <p className="text-[11px] text-slate-400 italic px-1 pb-0.5">Sin asesores asignados</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {/* Sin asignar */}
                    {unassignedAsesores.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 mt-2">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                    Sin asignar ({unassignedAsesores.length})
                                </p>
                            </div>
                            <div className="space-y-2">
                                {unassignedAsesores.map(asesor => (
                                    <button
                                        key={asesor.id}
                                        onClick={() => openDetail(asesor)}
                                        className="w-full glass-card p-3 rounded-xl flex items-center gap-3 text-left hover:border-blue-500/20 hover:bg-blue-500/5 transition-all group"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/15 flex items-center justify-center shrink-0">
                                            <span className="text-[11px] font-bold text-blue-400">{initials(asesor)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {profileName(asesor)}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate">{asesor.email}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {admins.length === 0 && asesores.length === 0 && (
                        <div className="py-16 text-center glass-card rounded-2xl border-dashed">
                            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 text-sm">No hay usuarios registrados aún.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== PANEL DETALLE ===== */}
            <SimpleModal
                isOpen={!!selectedProfile}
                onClose={() => setSelectedProfile(null)}
                title=""
            >
                {selectedProfile && (
                    <div className="p-6 space-y-6">

                        {/* Cabecera */}
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                                selectedProfile.role === 'admin'
                                    ? 'bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/20'
                                    : 'bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/15'
                            }`}>
                                <span className={`text-xl font-bold ${selectedProfile.role === 'admin' ? 'text-purple-300' : 'text-blue-400'}`}>
                                    {initials(selectedProfile)}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                    {profileName(selectedProfile)}
                                </h3>
                                <p className="text-sm text-slate-500 flex items-center gap-1.5 truncate">
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    {selectedProfile.email}
                                </p>
                                <span className={`mt-1 inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                                    selectedProfile.role === 'admin'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                }`}>
                                    {selectedProfile.role}
                                </span>

                                {/* Código productor (solo asesores) */}
                                {selectedProfile.role === 'asesor' && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Código productor"
                                            value={codigoEdit}
                                            onChange={e => setCodigoEdit(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveCodigo()}
                                            className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                                        />
                                        <button
                                            onClick={handleSaveCodigo}
                                            disabled={isSavingCodigo}
                                            className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                                        >
                                            {isSavingCodigo ? '...' : 'Guardar'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Toggle: aparecer en tablero */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/10 shrink-0">
                                        <Shield className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Aparece en tablero</p>
                                        <p className="text-[11px] text-slate-500 leading-tight">
                                            Permite asignarle leads directamente
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleToggleTablero(!selectedProfile.aparecer_en_tablero)}
                                    disabled={isTogglingTablero}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
                                        selectedProfile.aparecer_en_tablero ? 'bg-blue-600' : 'bg-slate-300 dark:bg-white/10'
                                    } disabled:opacity-50`}
                                    aria-label="Toggle aparecer en tablero"
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                                        selectedProfile.aparecer_en_tablero ? 'left-7' : 'left-1'
                                    }`} />
                                </button>
                            </div>
                        </div>

                        {/* Prepagas asignadas */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                    Prepagas asignadas
                                </p>
                                {!isAddingPrepaga && availablePrepagas.length > 0 && (
                                    <button
                                        onClick={() => setIsAddingPrepaga(true)}
                                        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Agregar
                                    </button>
                                )}
                            </div>

                            {isLoadingDetail ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : prepagasAsesor.length === 0 && !isAddingPrepaga ? (
                                <div className="py-6 text-center rounded-xl border border-dashed border-white/20">
                                    <p className="text-[12px] text-slate-400">Sin prepagas asignadas</p>
                                    {availablePrepagas.length > 0 && (
                                        <button
                                            onClick={() => setIsAddingPrepaga(true)}
                                            className="mt-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            + Asignar primera prepaga
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {prepagasAsesor.map(pa => (
                                        <div
                                            key={pa.id}
                                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                                    {pa.prepagas?.nombre ?? '—'}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    {pa.comision_pct != null ? `${pa.comision_pct}% comisión` : 'Sin comisión definida'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDesasignar(pa.prepaga_id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                                                title="Remover prepaga"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {isAddingPrepaga && (
                                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Nueva asignación</p>
                                        <button onClick={() => { setIsAddingPrepaga(false); setAddForm({ prepaga_id: '', comision_pct: '' }) }}>
                                            <X className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                                        </button>
                                    </div>
                                    <select
                                        value={addForm.prepaga_id}
                                        onChange={e => setAddForm(f => ({ ...f, prepaga_id: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-xl glass-input text-sm"
                                    >
                                        <option value="">Seleccioná una prepaga...</option>
                                        {availablePrepagas.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 block mb-1">Comisión %</label>
                                        <input
                                            type="number" step="0.01" min="0" max="100" placeholder="Ej: 5.5"
                                            value={addForm.comision_pct}
                                            onChange={e => setAddForm(f => ({ ...f, comision_pct: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl glass-input text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAsignarPrepaga}
                                        disabled={!addForm.prepaga_id || isSavingPrepaga}
                                        className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-colors"
                                    >
                                        {isSavingPrepaga ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        {isSavingPrepaga ? 'Guardando...' : 'Confirmar asignación'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </SimpleModal>

            {/* ===== MODAL CREAR ASESOR ===== */}
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
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                        {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                    </button>
                </form>
            </SimpleModal>
        </div>
    )
}
