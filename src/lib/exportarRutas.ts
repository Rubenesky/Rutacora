import type { Ruta } from '@/types/database.types'

/** rutacora-AAAA-MM-DD.json, con la fecha local del dispositivo. */
export function nombreArchivoExportacion(fecha: Date = new Date()): string {
  const aaaa = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `rutacora-${aaaa}-${mm}-${dd}.json`
}

/** JSON con todas las columnas de cada ruta tal cual (foto_path es solo la
 * ruta del archivo en Storage, nunca una URL firmada: esas se generan
 * aparte y caducan, no tiene sentido exportarlas). */
export function construirJsonExportacion(rutas: Ruta[]): string {
  return JSON.stringify(rutas, null, 2)
}

/** Dispara la descarga del JSON como archivo, vía Blob + enlace temporal
 * (funciona en Chrome de Android, a diferencia de un data: URI muy largo). */
export function descargarExportacion(rutas: Ruta[], fecha?: Date): void {
  const json = construirJsonExportacion(rutas)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivoExportacion(fecha)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
