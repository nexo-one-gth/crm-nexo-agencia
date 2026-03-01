'use client'

import { useState } from 'react'
import {
    Phone, Mail, MapPin, User, Calendar, Clock, CheckCircle2,
    AlertCircle, DollarSign, MessageCircle, FileText, Activity as ActivityIcon,
    ChevronRight, ArrowLeft, Send, History, UserCheck, Flame, CreditCard, Briefcase, Users, Edit
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { calculateLeadCompletion, getCompletionColor } from '@/lib/utils/lead-completion'
import { LeadEditModal } from '@/components/leads/LeadEditModal'

interface Activity {
    id: string
    type: string
    content: string
    created_at: string
}

interface LeadDetailViewProps {
    lead: any
    activities: Activity[]
}

export const LeadDetailView = ({ lead, activities }: LeadDetailViewProps) => {
    const [activeTab, setActiveTab] = useState('info')
    const [isEditOpen, setIsEditOpen] = useState(false)
    const completion = calculateLeadCompletion(lead)

    const getStageStyle = (stage: string) => {
        switch (stage) {
            case 'Pendiente':
            case 'Pendiente de Asignación':
                return 'from-blue-600 to-blue-400 text-white'
            case 'Contactado':
                return 'from-amber-500 to-yellow-400 text-white'
            case 'Interesado':
                return 'from-indigo-600 to-blue-500 text-white'
            case 'Cotizado':
                return 'from-orange-600 to-orange-400 text-white'
            case 'Alta en Proceso':
                return 'from-purple-600 to-pink-500 text-white'
            case 'Ganado':
                return 'from-green-600 to-emerald-400 text-white'
            case 'No Interesado':
                return 'from-slate-600 to-slate-400 text-white'
            default:
                return 'from-slate-600 to-slate-400 text-white'
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header / Banner */}
            <div className={`h-64 bg-gradient-to-br ${getStageStyle(lead.stage_name)} relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-white blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full bg-black blur-3xl" />
                </div>

                <div className="container mx-auto px-4 pt-8 h-full flex flex-col justify-between pb-8">
                    <div className="flex justify-between items-center w-full">
                        <Link href="/funnel" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors w-fit group">
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold">Volver al Funnel</span>
                        </Link>
                        <button
                            onClick={() => setIsEditOpen(true)}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors border border-white/20"
                        >
                            <Edit className="w-4 h-4" />
                            Editar Lead
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                    {lead.stage_name === 'No Interesado' ? 'Lead Perdido' : lead.stage_name}
                                </span>
                                {lead.assigned_to_name && (
                                    <span className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                                        <User className="w-4 h-4" /> Asesor: {lead.assigned_to_name}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                                {lead.first_name} {lead.last_name !== '.' ? lead.last_name : ''}
                            </h1>
                            <p className="text-xl text-white/80 font-medium">
                                {lead.edades ? `Edades: ${lead.edades}` : 'Sin edades registradas'}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
                                    <Users className="w-4 h-4" />
                                    <span className="text-xs font-bold">{lead.cantidad_integrantes || 0} integrantes</span>
                                </div>
                                {(lead.address_city || lead.address_state) && (
                                    <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-xs font-bold">{lead.address_city}{lead.address_city && lead.address_state ? ', ' : ''}{lead.address_state}</span>
                                    </div>
                                )}
                                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-xs font-bold">Ingresó {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: es })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Completion Score Circle */}
                        <div className="relative group">
                            <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-white/20"
                                />
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={2 * Math.PI * 40}
                                    strokeDashoffset={2 * Math.PI * 40 * (1 - completion / 100)}
                                    className="text-white transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black">{completion}</span>
                                <span className="text-[8px] font-black uppercase opacity-60">Score</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <LeadEditModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                lead={lead}
            />

            {/* Main Content */}
            <div className="container mx-auto px-4 -mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">

                    {/* Sidebar: Details Grid */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-3xl space-y-6 shadow-xl border-white/20">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Datos del Lead</h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Origen</span>
                                    <p className="text-sm font-bold truncate">{lead.source || 'No especificado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</span>
                                    <p className="text-sm font-bold flex items-center gap-1.5">
                                        <Phone className="w-3 h-3 text-green-500" />
                                        {lead.phone}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                                    <p className="text-sm font-bold truncate">{lead.email || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">DNI</span>
                                    <p className="text-sm font-bold">{lead.dni || '—'}</p>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cuil Titular</span>
                                    <p className="text-sm font-bold">{lead.cuil || '—'}</p>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Obra Social Actual</span>
                                    <p className="text-sm font-bold">{lead.obra_social || 'No declarada'}</p>
                                </div>
                            </div>

                            <hr className="border-white/10" />

                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-500/5 border border-white/10">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Interés Declarado</span>
                                        <p className="text-lg font-black tracking-tight">{lead.plan || 'Sin definir'}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl ${completion > 50 ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                        <Flame className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Next Action Box */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-blue-500/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ActivityIcon className="w-16 h-16 text-blue-500" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Próxima Acción
                            </h3>
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                                    <MessageCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-xl tracking-tight">Seguimiento por WhatsApp</p>
                                    <p className="text-sm text-slate-500 mt-1">Hoy antes de las 18hs · Revisar cotización</p>
                                </div>
                            </div>
                            <button className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                                Enviar Mensaje ahora
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Activities & Detailed Info */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Tabs Navigation */}
                        <div className="flex gap-2 p-1.5 bg-white/50 backdrop-blur-md dark:bg-black/20 rounded-2xl border border-white/20 w-fit">
                            {[
                                { id: 'info', label: 'Información Detallada', icon: FileText },
                                { id: 'history', label: 'Historial / Actividad', icon: History },
                                { id: 'quote', label: 'Cotización', icon: DollarSign }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-blue-400'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="glass-card min-h-[500px] rounded-3xl p-8 shadow-xl border-white/20">
                            {activeTab === 'info' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                    <User className="w-4 h-4" /> Datos de Identidad
                                                </h4>
                                                <div className="space-y-4">
                                                    <InfoRow label="CUIL Titular" value={lead.cuil} />
                                                    <InfoRow label="DNI" value={lead.dni} />
                                                    <InfoRow label="Email" value={lead.email} />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                    <Briefcase className="w-4 h-4" /> Contexto Laboral
                                                </h4>
                                                <div className="space-y-4">
                                                    <InfoRow label="CUIT Empleador" value={lead.cuit_empleador} />
                                                    <InfoRow label="Nro Trámite" value={lead.numero_tramite} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-8">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                                    <Users className="w-4 h-4" /> Grupo Familiar
                                                </h4>
                                                <div className="space-y-4">
                                                    <InfoRow label="Integrantes" value={lead.cantidad_integrantes} />
                                                    <InfoRow label="Edades" value={lead.edades} />
                                                </div>
                                            </div>
                                            <div className="p-6 rounded-3xl bg-slate-500/5 border border-white/10 italic text-slate-500 text-sm leading-relaxed">
                                                <p>"{lead.notes || 'Sin notas adicionales'}"</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                                    <div className="flex flex-col gap-6">
                                        {activities.length > 0 ? activities.map((activity, idx) => (
                                            <div key={activity.id} className="relative flex gap-6">
                                                {/* Line connection */}
                                                {idx !== activities.length - 1 && (
                                                    <div className="absolute top-10 left-5 w-0.5 h-full bg-slate-200 dark:bg-white/5" />
                                                )}

                                                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${activity.type === 'comment' ? 'bg-blue-500/10 text-blue-500' :
                                                    activity.type === 'whatsapp_sent' ? 'bg-green-500/10 text-green-500' :
                                                        'bg-slate-200 text-slate-500'
                                                    }`}>
                                                    {activity.type === 'comment' ? <MessageCircle className="w-5 h-5" /> :
                                                        activity.type === 'whatsapp_sent' ? <ActivityIcon className="w-5 h-5" /> :
                                                            <FileText className="w-5 h-5" />}
                                                </div>

                                                <div className="flex-1 pb-8">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-sm font-bold">{activity.content}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: es })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400">Acción registrada por el sistema</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center h-64 opacity-20">
                                                <History className="w-16 h-16 mb-4" />
                                                <p className="font-black text-xl">Sin historial registrado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'quote' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                                    {lead.valor_final_socio ? (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                                                    <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">Cuota Mensual Final</h5>
                                                    <p className="text-5xl font-black text-emerald-600 tracking-tighter">
                                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lead.valor_final_socio)}
                                                    </p>
                                                    <p className="text-sm text-emerald-600/60 mt-2 font-bold uppercase tracking-widest">Plan Seleccionado: {lead.plan}</p>
                                                </div>

                                                <div className="space-y-4 pt-4">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-400 font-bold">Valor Base</span>
                                                        <span className="font-black">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lead.valor_plan || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-400 font-bold">IVA</span>
                                                        <span className="font-black">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lead.iva || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm text-rose-500">
                                                        <span className="font-bold">Bonificación Aportes</span>
                                                        <span className="font-black">-{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lead.descuento_aportes || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm text-rose-500">
                                                        <span className="font-bold">Descuento Comercial</span>
                                                        <span className="font-black">-{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lead.descuento_comercial || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {lead.observaciones_cotizacion && (
                                                <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                                                    <h5 className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Observaciones</h5>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">"{lead.observaciones_cotizacion}"</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 opacity-20">
                                            <DollarSign className="w-16 h-16 mb-4" />
                                            <p className="font-black text-xl">Sin cotización generada</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const InfoRow = ({ label, value }: { label: string, value: any }) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-500/5 transition-colors px-2 rounded-lg">
        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{value || '—'}</span>
    </div>
)
