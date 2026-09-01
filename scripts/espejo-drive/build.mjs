#!/usr/bin/env node
/**
 * Construye el arbol espejo de Recursos en Google Drive.
 *
 * NO copia archivos y NO toca el arbol original: crea carpetas de categoria
 * dentro del espejo y adentro un acceso directo (shortcut) a cada carpeta o
 * archivo de origen. Los accesos directos ocupan 0 bytes y siempre muestran el
 * contenido vigente del original.
 *
 *   node scripts/espejo-drive/build.mjs            # dry-run, no escribe nada
 *   node scripts/espejo-drive/build.mjs --apply    # escribe
 *   node scripts/espejo-drive/build.mjs --apply --solo premedic,avalian
 *   node scripts/espejo-drive/build.mjs --apply --todas-las-categorias
 *
 * Es idempotente: si el acceso directo al mismo origen ya existe en esa
 * categoria, lo saltea. Se puede correr las veces que haga falta.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..', '..')
const MIME_CARPETA = 'application/vnd.google-apps.folder'
const MIME_SHORTCUT = 'application/vnd.google-apps.shortcut'

const args = process.argv.slice(2)
const APLICAR = args.includes('--apply')
const TODAS_CATS = args.includes('--todas-las-categorias')
const soloArg = args.find(a => a.startsWith('--solo'))
const SOLO = soloArg
  ? (soloArg.includes('=') ? soloArg.split('=')[1] : args[args.indexOf(soloArg) + 1] || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  : null

// --- credenciales -----------------------------------------------------------
// Se leen de .env.local o del entorno. Bajalas con: vercel env pull .env.local
function cargarEnvLocal() {
  try {
    const txt = readFileSync(join(RAIZ, '.env.local'), 'utf8')
    for (const linea of txt.split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch { /* sin .env.local, se usa el entorno */ }
}
cargarEnvLocal()

const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!EMAIL || !KEY) {
  console.error(
    'Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y/o GOOGLE_PRIVATE_KEY.\n' +
    'Corre "vercel env pull .env.local" en la raiz del proyecto y volve a intentar.'
  )
  process.exit(1)
}

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: EMAIL, private_key: KEY },
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

const COMUN = { supportsAllDrives: true, includeItemsFromAllDrives: true }

async function hijos(parentId) {
  const out = []
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, shortcutDetails(targetId))',
      pageSize: 200,
      pageToken,
      ...COMUN,
    })
    out.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return out
}

async function asegurarCarpeta(parentId, nombre, cache) {
  const existente = cache.find(f => f.mimeType === MIME_CARPETA && f.name === nombre)
  if (existente) return { id: existente.id, creada: false }
  if (!APLICAR) return { id: `(dry-run:${nombre})`, creada: true }
  const res = await drive.files.create({
    requestBody: { name: nombre, mimeType: MIME_CARPETA, parents: [parentId] },
    fields: 'id',
    ...COMUN,
  })
  return { id: res.data.id, creada: true }
}

async function asegurarShortcut(parentId, nombre, targetId, cache) {
  const yaEsta = cache.find(f => f.shortcutDetails?.targetId === targetId)
  if (yaEsta) return 'ya-existia'
  if (!APLICAR) return 'crear'
  try {
    await drive.files.create({
      requestBody: {
        name: nombre,
        mimeType: MIME_SHORTCUT,
        parents: [parentId],
        shortcutDetails: { targetId },
      },
      fields: 'id',
      ...COMUN,
    })
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (/storageQuota|storage quota/i.test(msg)) {
      console.error(
        '\nEl service account no tiene cuota de almacenamiento y Drive rechazo el acceso directo.\n' +
        'Salidas posibles:\n' +
        '  1) Mover el espejo a una Unidad Compartida donde el service account sea miembro.\n' +
        '  2) Correr este script con una cuenta de usuario (OAuth) en vez del service account.\n'
      )
      process.exit(1)
    }
    throw e
  }
  return 'creado'
}

// --- main -------------------------------------------------------------------
const mapa = JSON.parse(readFileSync(join(AQUI, 'mapa.json'), 'utf8'))
const nombreCat = new Map(mapa.categorias.map(c => [c.id, c.nombre]))

console.log(APLICAR ? '>> MODO APLICAR: se va a escribir en Drive\n' : '>> DRY RUN: no se escribe nada. Agrega --apply para ejecutar.\n')

const resumen = { carpetas: 0, shortcuts: 0, saltados: 0, rotos: [] }

for (const prepaga of mapa.prepagas) {
  if (SOLO && !SOLO.includes(prepaga.slug)) continue
  console.log(`\n=== ${prepaga.nombre} ===`)
  if (prepaga.nota) console.log(`    nota: ${prepaga.nota}`)

  const catsConItems = new Set(prepaga.items.map(i => i.cat))
  const catsAcrear = mapa.categorias.filter(c => TODAS_CATS || catsConItems.has(c.id))
  const hijosPrepaga = await hijos(prepaga.espejoId)

  for (const cat of catsAcrear) {
    const { id: catId, creada } = await asegurarCarpeta(prepaga.espejoId, cat.nombre, hijosPrepaga)
    if (creada) resumen.carpetas++

    const items = prepaga.items.filter(i => i.cat === cat.id)
    if (items.length === 0) {
      console.log(`  ${cat.nombre}  ${creada ? '(creada, vacia)' : '(vacia)'}`)
      continue
    }

    const hijosCat = creada ? [] : await hijos(catId)
    console.log(`  ${cat.nombre}`)
    for (const item of items) {
      // Verifica que el origen siga existiendo antes de apuntarle
      try {
        await drive.files.get({ fileId: item.id, fields: 'id, name, trashed', ...COMUN })
      } catch {
        console.log(`    !! ORIGEN INACCESIBLE: ${item.nombre} (${item.id})`)
        resumen.rotos.push(`${prepaga.nombre} / ${item.nombre}`)
        continue
      }
      const r = await asegurarShortcut(catId, item.nombre, item.id, hijosCat)
      if (r === 'ya-existia') { resumen.saltados++; console.log(`    = ${item.nombre}`) }
      else { resumen.shortcuts++; console.log(`    + ${item.nombre}`) }
    }
  }

  for (const ex of prepaga.excluidos) {
    console.log(`  (excluido) ${ex.nombre} — ${ex.motivo}`)
  }
}

console.log('\n--- resumen ---')
console.log(`carpetas de categoria: ${resumen.carpetas}`)
console.log(`accesos directos ${APLICAR ? 'creados' : 'a crear'}: ${resumen.shortcuts}`)
console.log(`ya existian (salteados): ${resumen.saltados}`)
if (resumen.rotos.length) {
  console.log(`\norigenes inaccesibles (${resumen.rotos.length}):`)
  for (const r of resumen.rotos) console.log(`  - ${r}`)
}
console.log(`\nEspejo: https://drive.google.com/drive/folders/${mapa.espejoRootId}`)
