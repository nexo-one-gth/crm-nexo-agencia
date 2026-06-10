'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  crearPrepaga, actualizarPrepaga, crearPlan, eliminarPlan,
  asignarAsesor, desasignarAsesor, getAsesoresDePrepaga,
  getPlantillasDePrepaga, agregarItemPlantilla, eliminarItemPlantilla,
} from '@/app/actions/prepaga-actions'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Users, FileText, ChevronDown, ChevronUp, X, Check } from 'lucide-react'

type Prepaga = {
  id: string; nombre: string; slug: string; activa: boolean
  tipo_cotizador: string; cotizador_url: string | null
  notas_admin: string | null; orden: number
}
type Asesor = { id: string; first_name: string | null; last_name: string | null; email: string | null }

const TIPOS_COTIZADOR = ['externo', 'integrado', 'pdf', 'manual'] as const

interface Props {
  prepagas: Prepaga[]
  asesores: Asesor[]
}

export function PrepagasAdminClient({ prepagas, asesores }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandida, setExpandida] = useState<string | null>(null)
  const [modoNueva, setModoNueva] = useState(false)

  // Form nueva prepaga
  const [formNueva, setFormNueva] = useState({
    nombre: '', slug: '', tipo_cotizador: 'externo' as const,
    cotizador_url: '', notas_admin: '', orden: prepagas.length + 1, activa: true,
  })

  function slugify(nombre: string) {
    return nombre.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function handleNombreChange(nombre: string) {
    setFormNueva(f => ({ ...f, nombre, slug: slugify(nombre) }))
  }

  async function handleCrearPrepaga(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await crearPrepaga({
        ...formNueva,
        cotizador_url: formNueva.cotizador_url || undefined,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Prepaga creada')
      setModoNueva(false)
      setFormNueva({ nombre: '', slug: '', tipo_cotizador: 'externo', cotizador_url: '', notas_admin: '', orden: prepagas.length + 2, activa: true })
      router.refresh()
    })
  }

  async function toggleActiva(prepaga: Prepaga) {
    startTransition(async () => {
      const res = await actualizarPrepaga(prepaga.id, { activa: !prepaga.activa })
      if (res.error) { toast.error(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Botón nueva prepaga */}
      <div className="flex justify-end">
        <button
          onClick={() => setModoNueva(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nueva prepaga
        </button>
      </div>

      {/* Form nueva prepaga */}
      {modoNueva && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200 dark:border-blue-700/40 p-5">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Nueva prepaga</h3>
          <form onSubmit={handleCrearPrepaga} className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nombre *</label>
              <input required value={formNueva.nombre} onChange={e => handleNombreChange(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Slug *</label>
              <input required value={formNueva.slug} onChange={e => setFormNueva(f => ({ ...f, slug: e.target.value }))}
                pattern="[a-z0-9-]+"
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tipo cotizador</label>
              <select value={formNueva.tipo_cotizador} onChange={e => setFormNueva(f => ({ ...f, tipo_cotizador: e.target.value as typeof formNueva.tipo_cotizador }))}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS_COTIZADOR.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">URL cotizador</label>
              <input type="url" value={formNueva.cotizador_url} onChange={e => setFormNueva(f => ({ ...f, cotizador_url: e.target.value }))}
                placeholder="https://..."
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Notas admin</label>
              <textarea value={formNueva.notas_admin} onChange={e => setFormNueva(f => ({ ...f, notas_admin: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setModoNueva(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {isPending ? 'Guardando...' : 'Crear prepaga'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de prepagas */}
      {prepagas.map(prepaga => (
        <div key={prepaga.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white">{prepaga.nombre}</h3>
                <span className="text-xs font-mono text-slate-400">/{prepaga.slug}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prepaga.activa ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                  {prepaga.activa ? 'Activa' : 'Inactiva'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {prepaga.tipo_cotizador}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => toggleActiva(prepaga)} disabled={isPending}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"
                title={prepaga.activa ? 'Desactivar' : 'Activar'}>
                {prepaga.activa ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setExpandida(expandida === prepaga.id ? null : prepaga.id)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"
              >
                {expandida === prepaga.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Panel expandido */}
          {expandida === prepaga.id && (
            <div className="border-t border-slate-100 dark:border-white/10 p-4 space-y-6">
              <PlanesSection prepagaId={prepaga.id} />
              <AsesoresSection prepagaId={prepaga.id} asesores={asesores} />
              <ChecklistSection prepagaId={prepaga.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-sección: Planes
// ---------------------------------------------------------------------------
function PlanesSection({ prepagaId }: { prepagaId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [planes, setPlanes] = useState<{ id: string; nombre: string; descripcion: string | null; activo: boolean }[]>([])
  const [cargado, setCargado] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')

  async function cargar() {
    if (cargado) return
    const { getPlanesPorPrepaga } = await import('@/app/actions/prepaga-actions')
    const data = await getPlanesPorPrepaga(prepagaId)
    setPlanes(data)
    setCargado(true)
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await crearPlan({ prepaga_id: prepagaId, nombre: nuevoNombre, descripcion: nuevaDesc || undefined, orden: planes.length + 1 })
      if (res.error) { toast.error(res.error); return }
      toast.success('Plan creado')
      setNuevoNombre(''); setNuevaDesc('')
      const { getPlanesPorPrepaga } = await import('@/app/actions/prepaga-actions')
      setPlanes(await getPlanesPorPrepaga(prepagaId))
      router.refresh()
    })
  }

  async function handleEliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarPlan(id)
      if (res.error) { toast.error(res.error); return }
      setPlanes(p => p.filter(x => x.id !== id))
      router.refresh()
    })
  }

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5" />
        Planes
        {!cargado && (
          <button onClick={cargar} className="text-blue-600 normal-case font-normal hover:underline">cargar</button>
        )}
      </h4>

      {cargado && (
        <div className="space-y-2">
          {planes.map(plan => (
            <div key={plan.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200">{plan.nombre}</span>
                {plan.descripcion && <span className="ml-2 text-slate-400 text-xs">{plan.descripcion}</span>}
              </div>
              <button onClick={() => handleEliminar(plan.id)} disabled={isPending}
                className="text-rose-500 hover:text-rose-700 transition-colors p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <form onSubmit={handleCrear} className="flex items-center gap-2 mt-2">
            <input required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Nombre del plan"
              className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isPending}
              className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-sección: Asesores
// ---------------------------------------------------------------------------
function AsesoresSection({ prepagaId, asesores }: { prepagaId: string; asesores: Asesor[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [asignados, setAsignados] = useState<{
    id: string | null; asesor_id: string | null; comision_pct: number | null
    codigo_productor: string | null; activo: boolean | null
    profiles?: { first_name: string | null; last_name: string | null; email: string | null } | null
  }[]>([])
  const [cargado, setCargado] = useState(false)
  const [asesorId, setAsesorId] = useState('')
  const [comision, setComision] = useState('')
  const [codigo, setCodigo] = useState('')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')

  async function cargar() {
    if (cargado) return
    const data = await getAsesoresDePrepaga(prepagaId)
    setAsignados(data as typeof asignados)
    setCargado(true)
  }

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await asignarAsesor({
        prepaga_id: prepagaId,
        asesor_id: asesorId,
        comision_pct: comision ? Number(comision) : null,
        codigo_productor: codigo || null,
        credenciales: usuario || clave ? { usuario, clave } : {},
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Asesor asignado')
      setAsesorId(''); setComision(''); setCodigo(''); setUsuario(''); setClave('')
      const data = await getAsesoresDePrepaga(prepagaId)
      setAsignados(data as typeof asignados)
      router.refresh()
    })
  }

  async function handleDesasignar(aId: string) {
    startTransition(async () => {
      const res = await desasignarAsesor(prepagaId, aId)
      if (res.error) { toast.error(res.error); return }
      const data = await getAsesoresDePrepaga(prepagaId)
      setAsignados(data as typeof asignados)
      router.refresh()
    })
  }

  const noAsignados = asesores.filter(a => !asignados.some(x => x.asesor_id === a.id && x.activo))

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        Asesores asignados
        {!cargado && (
          <button onClick={cargar} className="text-blue-600 normal-case font-normal hover:underline">cargar</button>
        )}
      </h4>

      {cargado && (
        <div className="space-y-2">
          {asignados.filter(a => a.activo).map(a => {
            const prof = a.profiles
            return (
              <div key={a.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {prof?.first_name} {prof?.last_name}
                  </span>
                  <span className="ml-2 text-slate-400 text-xs">{prof?.email}</span>
                  {a.comision_pct && <span className="ml-2 text-xs text-blue-600">{a.comision_pct}%</span>}
                  {a.codigo_productor && <span className="ml-2 text-xs text-slate-400">Cód: {a.codigo_productor}</span>}
                </div>
                <button onClick={() => a.asesor_id && handleDesasignar(a.asesor_id)} disabled={isPending}
                  className="text-rose-500 hover:text-rose-700 transition-colors p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {noAsignados.length > 0 && (
            <form onSubmit={handleAsignar} className="space-y-2 mt-2 bg-slate-50 dark:bg-white/5 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Asignar asesor</p>
              <div className="grid grid-cols-2 gap-2">
                <select required value={asesorId} onChange={e => setAsesorId(e.target.value)}
                  className="col-span-2 px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar asesor...</option>
                  {noAsignados.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</option>)}
                </select>
                <input value={comision} onChange={e => setComision(e.target.value)} type="number" min="0" max="100" step="0.01"
                  placeholder="Comisión %"
                  className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={codigo} onChange={e => setCodigo(e.target.value)}
                  placeholder="Código productor"
                  className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={usuario} onChange={e => setUsuario(e.target.value)}
                  placeholder="Usuario cotizador"
                  className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={clave} onChange={e => setClave(e.target.value)} type="password"
                  placeholder="Clave cotizador"
                  className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={isPending || !asesorId}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Asignar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-sección: Checklist plantilla
// ---------------------------------------------------------------------------
function ChecklistSection({ prepagaId }: { prepagaId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [plantillas, setPlantillas] = useState<{
    id: string; nombre: string
    checklist_plantilla_items: { id: string; etiqueta: string; tipo_dato: string; requerido: boolean; orden: number }[]
  }[]>([])
  const [cargado, setCargado] = useState(false)
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string | null>(null)
  const [nuevoItem, setNuevoItem] = useState({ etiqueta: '', tipo_dato: 'check' as const, requerido: true })

  async function cargar() {
    if (cargado) return
    const data = await getPlantillasDePrepaga(prepagaId)
    setPlantillas(data as typeof plantillas)
    if (data.length > 0) setPlantillaSeleccionada(data[0].id)
    setCargado(true)
  }

  async function handleAgregarItem(e: React.FormEvent) {
    e.preventDefault()
    if (!plantillaSeleccionada) return
    startTransition(async () => {
      const plantilla = plantillas.find(p => p.id === plantillaSeleccionada)
      const res = await agregarItemPlantilla({
        plantilla_id: plantillaSeleccionada,
        ...nuevoItem,
        orden: (plantilla?.checklist_plantilla_items?.length ?? 0) + 1,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('Ítem agregado')
      setNuevoItem({ etiqueta: '', tipo_dato: 'check', requerido: true })
      const data = await getPlantillasDePrepaga(prepagaId)
      setPlantillas(data as typeof plantillas)
      router.refresh()
    })
  }

  async function handleEliminarItem(id: string) {
    startTransition(async () => {
      const res = await eliminarItemPlantilla(id)
      if (res.error) { toast.error(res.error); return }
      const data = await getPlantillasDePrepaga(prepagaId)
      setPlantillas(data as typeof plantillas)
      router.refresh()
    })
  }

  const plantillaActual = plantillas.find(p => p.id === plantillaSeleccionada)

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Pencil className="w-3.5 h-3.5" />
        Checklist de alta
        {!cargado && (
          <button onClick={cargar} className="text-blue-600 normal-case font-normal hover:underline">cargar</button>
        )}
      </h4>

      {cargado && (
        <div className="space-y-3">
          {plantillas.length > 1 && (
            <select value={plantillaSeleccionada ?? ''} onChange={e => setPlantillaSeleccionada(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none">
              {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}

          {plantillaActual && (
            <div className="space-y-1.5">
              {plantillaActual.checklist_plantilla_items
                .sort((a, b) => a.orden - b.orden)
                .map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.requerido ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <span className="flex-1 text-slate-800 dark:text-slate-200">{item.etiqueta}</span>
                    <span className="text-xs text-slate-400">{item.tipo_dato}</span>
                    <button onClick={() => handleEliminarItem(item.id)} disabled={isPending}
                      className="text-rose-500 hover:text-rose-700 transition-colors p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

              <form onSubmit={handleAgregarItem} className="flex items-center gap-2 mt-2">
                <input required value={nuevoItem.etiqueta} onChange={e => setNuevoItem(n => ({ ...n, etiqueta: e.target.value }))}
                  placeholder="Etiqueta del ítem"
                  className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={nuevoItem.tipo_dato} onChange={e => setNuevoItem(n => ({ ...n, tipo_dato: e.target.value as typeof nuevoItem.tipo_dato }))}
                  className="px-2 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none">
                  {['check', 'texto', 'archivo', 'fecha', 'numero'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={nuevoItem.requerido} onChange={e => setNuevoItem(n => ({ ...n, requerido: e.target.checked }))} />
                  Req.
                </label>
                <button type="submit" disabled={isPending}
                  className="px-3 py-1.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
