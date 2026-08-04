import { google } from 'googleapis'
import { unstable_cache } from 'next/cache'
import { Readable } from 'node:stream'

export type DriveItem = {
  id: string
  nombre: string
  mimeType: string
  fechaModificacion: string
  urlVista: string
  esArchivo: boolean
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

// Auth con permiso de escritura. Se usa para crear la carpeta del trámite y
// subir la documentación desde el CRM. IMPORTANTE: el service account no tiene
// cuota de almacenamiento propia, así que las carpetas destino deben vivir en
// una Unidad Compartida (Shared Drive) de la que el service account sea miembro.
function getWriteAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export type DriveArchivo = { id: string; nombre: string; urlVista: string }

// Crea una subcarpeta dentro de `parentId` y devuelve su id + link de vista.
// Si ya existe una carpeta con el mismo nombre en ese padre, la reutiliza
// (idempotente: evita duplicar carpetas si se reintenta el alta).
export async function crearCarpetaDrive(
  parentId: string,
  nombre: string
): Promise<DriveArchivo> {
  const drive = google.drive({ version: 'v3', auth: getWriteAuth() })

  const nombreEscapado = nombre.replace(/'/g, "\\'")
  const existente = await drive.files.list({
    q: `'${parentId}' in parents and name = '${nombreEscapado}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const yaExiste = existente.data.files?.[0]
  if (yaExiste?.id) {
    return {
      id: yaExiste.id,
      nombre: yaExiste.name ?? nombre,
      urlVista: yaExiste.webViewLink ?? `https://drive.google.com/drive/folders/${yaExiste.id}`,
    }
  }

  const res = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  })
  return {
    id: res.data.id!,
    nombre: res.data.name ?? nombre,
    urlVista: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${res.data.id}`,
  }
}

// Sube un archivo (buffer) a la carpeta indicada. Si ya existe uno con el
// mismo nombre, lo reemplaza (nueva versión) para no acumular duplicados.
export async function subirArchivoDrive(
  folderId: string,
  buffer: Buffer,
  nombre: string,
  mimeType: string
): Promise<DriveArchivo> {
  const drive = google.drive({ version: 'v3', auth: getWriteAuth() })

  const nombreEscapado = nombre.replace(/'/g, "\\'")
  const existente = await drive.files.list({
    q: `'${folderId}' in parents and name = '${nombreEscapado}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const fileId = existente.data.files?.[0]?.id

  const media = { mimeType, body: Readable.from(buffer) }

  const res = fileId
    ? await drive.files.update({
        fileId,
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      })
    : await drive.files.create({
        requestBody: { name: nombre, parents: [folderId] },
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      })

  return {
    id: res.data.id!,
    nombre: res.data.name ?? nombre,
    urlVista: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

// Crea/actualiza un Google Doc a partir de texto plano dentro de una carpeta.
// Se usa para guardar el "resumen del trámite" como documento editable.
export async function guardarDocResumen(
  folderId: string,
  nombre: string,
  texto: string
): Promise<DriveArchivo> {
  const drive = google.drive({ version: 'v3', auth: getWriteAuth() })

  const nombreEscapado = nombre.replace(/'/g, "\\'")
  const existente = await drive.files.list({
    q: `'${folderId}' in parents and name = '${nombreEscapado}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const fileId = existente.data.files?.[0]?.id

  // Subimos texto plano y dejamos que Drive lo convierta a Google Doc.
  const media = { mimeType: 'text/plain', body: Readable.from(Buffer.from(texto, 'utf-8')) }

  const res = fileId
    ? await drive.files.update({
        fileId,
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      })
    : await drive.files.create({
        requestBody: {
          name: nombre,
          parents: [folderId],
          mimeType: 'application/vnd.google-apps.document',
        },
        media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      })

  return {
    id: res.data.id!,
    nombre: res.data.name ?? nombre,
    urlVista: res.data.webViewLink ?? `https://drive.google.com/document/d/${res.data.id}/edit`,
  }
}

export const listarContenidoCarpeta = unstable_cache(
  async (folderId: string): Promise<DriveItem[]> => {
    try {
      const drive = google.drive({ version: 'v3', auth: getAuth() })
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
        orderBy: 'folder,name',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      return (res.data.files ?? []).map(f => ({
        id: f.id!,
        nombre: f.name!,
        mimeType: f.mimeType!,
        fechaModificacion: f.modifiedTime!,
        urlVista: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
        esArchivo: f.mimeType !== 'application/vnd.google-apps.folder',
      }))
    } catch (error) {
      console.error('[Google Drive] Error listando carpeta:', folderId, error)
      throw error
    }
  },
  ['drive-folder'],
  { revalidate: 300 }
)

export const obtenerMetadataArchivo = unstable_cache(
  async (fileId: string) => {
    try {
      const drive = google.drive({ version: 'v3', auth: getAuth() })
      const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, webViewLink',
      })
      return {
        id: res.data.id!,
        nombre: res.data.name!,
        mimeType: res.data.mimeType!,
        fechaModificacion: res.data.modifiedTime!,
        urlVista: res.data.webViewLink!,
      }
    } catch (error) {
      console.error('[Google Drive] Error obteniendo metadata:', fileId, error)
      throw error
    }
  },
  ['drive-file-meta'],
  { revalidate: 300 }
)

// Lista los IDs de las subcarpetas directas de una carpeta.
// Nota: no podemos autorizar subiendo por `parents` porque, cuando una carpeta
// está compartida con el service account (no es dueño), la API de Drive devuelve
// el campo `parents` vacío. Por eso descendemos desde las raíces permitidas.
const listarSubcarpetasIds = unstable_cache(
  async (folderId: string): Promise<string[]> => {
    const drive = google.drive({ version: 'v3', auth: getAuth() })
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    return (res.data.files ?? []).map(f => f.id!).filter(Boolean)
  },
  ['drive-subfolders'],
  { revalidate: 300 }
)

// Valida que folderId sea una de las carpetas raíz permitidas o descendiente
// de alguna de ellas. Desciende por el árbol (BFS) listando subcarpetas hasta
// encontrar la carpeta pedida o agotar profundidad/presupuesto. Sirve tanto
// para la carpeta global (GOOGLE_DRIVE_ROOT_FOLDER_ID) como para las carpetas
// por prepaga (prepagas.drive_folder_id).
export async function esDescendienteDeAlguna(
  folderId: string,
  rootIds: string[]
): Promise<boolean> {
  const roots = rootIds.filter(Boolean)
  if (roots.length === 0) return false
  if (roots.includes(folderId)) return true

  const visited = new Set<string>()
  let frontier = [...new Set(roots)]
  let presupuesto = 400 // cota de carpetas visitadas por request

  for (let depth = 0; depth < 8 && frontier.length > 0 && presupuesto > 0; depth++) {
    const siguiente: string[] = []
    for (const id of frontier) {
      if (visited.has(id) || presupuesto <= 0) continue
      visited.add(id)
      presupuesto--
      let hijos: string[]
      try {
        hijos = await listarSubcarpetasIds(id)
      } catch {
        continue
      }
      if (hijos.includes(folderId)) return true
      siguiente.push(...hijos)
    }
    frontier = siguiente
  }
  return false
}

// Compatibilidad: valida contra la carpeta raíz global configurada por env.
export async function esBajoCarpetaRaiz(folderId: string): Promise<boolean> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!rootId) return false
  return esDescendienteDeAlguna(folderId, [rootId])
}

// Descarga los bytes de un archivo de Drive (files.get alt=media).
export async function descargarArchivoDrive(fileId: string): Promise<Buffer> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

// Extrae el texto plano de un PDF. Usa pdf-parse (import dinámico para evitar
// que el harness de debug del paquete corra al importar, y para degradar
// con un error claro si la dependencia no está instalada).
export async function extraerTextoPdf(buffer: Buffer): Promise<string> {
  try {
    const mod = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('[PDF] Error extrayendo texto:', error)
    throw new Error(
      'No se pudo leer el PDF. Verificá que la dependencia "pdf-parse" esté instalada (npm install pdf-parse) o pegá el texto manualmente.'
    )
  }
}

// Lista recursivamente (1 nivel de subcarpetas) los PDFs bajo una carpeta.
export async function listarPdfsDeCarpeta(folderId: string): Promise<DriveItem[]> {
  const raiz = await listarContenidoCarpeta(folderId)
  const pdfs = raiz.filter(i => i.esArchivo && i.mimeType === 'application/pdf')
  const subcarpetas = raiz.filter(i => !i.esArchivo)
  for (const sub of subcarpetas) {
    try {
      const hijos = await listarContenidoCarpeta(sub.id)
      pdfs.push(...hijos.filter(i => i.esArchivo && i.mimeType === 'application/pdf'))
    } catch {
      // ignorar subcarpetas inaccesibles
    }
  }
  return pdfs
}
