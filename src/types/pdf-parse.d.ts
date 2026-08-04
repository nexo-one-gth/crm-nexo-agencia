// pdf-parse solo publica tipos para el entrypoint 'pdf-parse', no para el
// subpath interno 'pdf-parse/lib/pdf-parse.js' que usamos para evitar el
// harness de debug del paquete. Declaramos ese subpath acá.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    version: string
    text: string
  }
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: unknown): Promise<PdfParseResult>
  export default pdfParse
}
