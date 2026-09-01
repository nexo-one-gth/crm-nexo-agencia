# Espejo de Recursos en Drive

Arbol paralelo con la taxonomia canonica, **sin tocar el Drive original**.

- Espejo: https://drive.google.com/drive/folders/1XPKPeqvnKCMdIHQyTNHOPt8WRyDFtwYA
- Origen: https://drive.google.com/drive/folders/1hZfCQqBdNGyKjdmUsVK0LSRp69tymAxB

## Como funciona

Cada categoria del espejo contiene **accesos directos** (shortcuts) a las
carpetas originales. Eso significa:

- No se duplica ni un archivo: cero storage, cero divergencia.
- Si alguien sube la lista de precios de septiembre al original, aparece sola
  en el espejo.
- Renombrar o reagrupar en el espejo **no cambia nada** en el original ni en los
  links que ya circulan por WhatsApp.
- Borrar un acceso directo del espejo no borra el original.

El espejo vive fuera de la carpeta compartida actual, asi que no aparece en
`/recursos` del CRM ni lo ve ningun asesor hasta que se decida apuntarlo ahi.

## Correrlo

Las credenciales del service account estan solo en Vercel:

```bash
vercel env pull .env.local          # trae GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY
node scripts/espejo-drive/build.mjs           # dry-run: muestra que haria
node scripts/espejo-drive/build.mjs --apply   # ejecuta
```

Opciones:

| Flag | Que hace |
|---|---|
| `--apply` | Escribe en Drive. Sin esto es dry-run. |
| `--solo premedic,avalian` | Procesa solo esas prepagas (por slug). |
| `--todas-las-categorias` | Crea las 17 carpetas incluso las que quedarian vacias, para que el hueco se vea. |

Es idempotente: si el acceso directo ya existe, lo saltea. Se puede correr las
veces que haga falta. Antes de crear cada acceso directo verifica que el origen
siga existiendo y avisa si alguno esta inaccesible.

## Cambiar la clasificacion

Todo el criterio vive en `mapa.json`, no en el script. Para mover una carpeta de
categoria, cambiale el `cat` en `mapa.json` y volve a correr con `--apply`
(despues borra a mano el acceso directo viejo del espejo).

## Que falta antes de apuntar el CRM al espejo

`lib/google-drive.ts` todavia no resuelve accesos directos: los listaria como
items de mimeType `application/vnd.google-apps.shortcut` y al hacer click no
mostraria nada. Hay que resolver `shortcutDetails.targetId` en
`listarContenidoCarpeta` y en `esDescendienteDeAlguna`. Son ~15 lineas.
Hasta entonces el espejo se usa desde Drive directamente.
