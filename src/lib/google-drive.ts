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

// Valida que folderId sea descendiente de la carpeta raíz configurada.
// Sube el árbol de padres hasta encontrar el root o agotar la profundidad.
export async function esBajoCarpetaRaiz(folderId: string): Promise<boolean> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!rootId) return false
  if (folderId === rootId) return true

  const drive = google.drive({ version: 'v3', auth: getAuth() })
  let currentId = folderId

  for (let depth = 0; depth < 8; depth++) {
    try {
      const res = await drive.files.get({ fileId: currentId, fields: 'parents' })
      const parents = res.data.parents ?? []
      if (parents.includes(rootId)) return true
      if (parents.length === 0) return false
      currentId = parents[0]
    } catch {
      return false
    }
  }
  return false
}
