import { google } from 'googleapis'
import { unstable_cache } from 'next/cache'

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
