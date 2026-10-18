import exifr from 'exifr'

export const LADO_MAXIMO_PX = 1600
export const CALIDADES_A_PROBAR = [0.8, 0.6, 0.4] as const
export const TECHO_BYTES = 0.5 * 1024 * 1024 // 0.5 MB
export const TAMANO_MAXIMO_ORIGINAL_BYTES = 40 * 1024 * 1024 // 40 MB

export class ErrorFoto extends Error {}

export interface UbicacionExif {
  lat: number
  lon: number
}

export interface ResultadoProcesarFoto {
  blob: Blob
  ubicacionExif: UbicacionExif | null
}

/** Dimensiones finales manteniendo proporción, sin ampliar, con tope en el lado largo. */
export function calcularDimensiones(
  anchoOriginal: number,
  altoOriginal: number,
  ladoMaximo: number,
): { ancho: number; alto: number } {
  const ladoMayor = Math.max(anchoOriginal, altoOriginal)
  const escala = ladoMayor > ladoMaximo ? ladoMaximo / ladoMayor : 1
  return {
    ancho: Math.max(1, Math.round(anchoOriginal * escala)),
    alto: Math.max(1, Math.round(altoOriginal * escala)),
  }
}

/** true para las orientaciones EXIF que implican un giro de 90°. */
function giraNoventaGrados(orientacion: number): boolean {
  return orientacion >= 5 && orientacion <= 8
}

/**
 * Aplica en "ctx" la transformación de la orientación EXIF indicada, dibuja
 * la imagen fuente ya redimensionada y orientada, y devuelve el canvas listo
 * para exportar. "dibujoAncho"/"dibujoAlto" son las dimensiones (ya a
 * escala) de la fuente TAL CUAL está almacenada (antes de aplicar el giro).
 */
function dibujarConOrientacion(
  canvas: HTMLCanvasElement,
  fuente: CanvasImageSource,
  dibujoAncho: number,
  dibujoAlto: number,
  orientacion: number,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ErrorFoto('No se pudo preparar el lienzo para procesar la foto.')

  switch (orientacion) {
    case 2:
      ctx.transform(-1, 0, 0, 1, dibujoAncho, 0)
      break
    case 3:
      ctx.transform(-1, 0, 0, -1, dibujoAncho, dibujoAlto)
      break
    case 4:
      ctx.transform(1, 0, 0, -1, 0, dibujoAlto)
      break
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0)
      break
    case 6:
      ctx.transform(0, 1, -1, 0, dibujoAlto, 0)
      break
    case 7:
      ctx.transform(0, -1, -1, 0, dibujoAlto, dibujoAncho)
      break
    case 8:
      ctx.transform(0, -1, 1, 0, 0, dibujoAncho)
      break
    default:
      break // 1 (o sin orientación): sin transformación
  }

  ctx.drawImage(fuente, 0, 0, dibujoAncho, dibujoAlto)
}

/**
 * Redimensiona (máx. LADO_MAXIMO_PX en el lado largo, sin recortar),
 * corrige la orientación EXIF y recodifica como JPEG, de modo que la salida
 * NUNCA conserva metadatos EXIF/GPS (un canvas no los preserva al exportar).
 */
export async function recomprimirImagen(
  fuente: CanvasImageSource & { width: number; height: number },
  orientacionExif: number,
): Promise<Blob> {
  const anchoBruto = fuente.width
  const altoBruto = fuente.height

  // Dimensiones "lógicas" (como se ve la foto una vez orientada).
  const [anchoLogico, altoLogico] = giraNoventaGrados(orientacionExif)
    ? [altoBruto, anchoBruto]
    : [anchoBruto, altoBruto]

  const { ancho: anchoFinal, alto: altoFinal } = calcularDimensiones(
    anchoLogico,
    altoLogico,
    LADO_MAXIMO_PX,
  )

  const escala = anchoLogico > 0 ? anchoFinal / anchoLogico : 1
  const dibujoAncho = Math.max(1, Math.round(anchoBruto * escala))
  const dibujoAlto = Math.max(1, Math.round(altoBruto * escala))

  const canvas = document.createElement('canvas')
  canvas.width = anchoFinal
  canvas.height = altoFinal

  dibujarConOrientacion(canvas, fuente, dibujoAncho, dibujoAlto, orientacionExif)

  return elegirMejorCalidad(
    (calidad) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', calidad)
      }),
    TECHO_BYTES,
  )
}

/**
 * Prueba las calidades indicadas en orden (de más a menos calidad) y se
 * queda con la primera que no supere el techo de peso. Si ninguna lo
 * respeta, no persigue un peso exacto: usa la última probada (la de menor
 * calidad) tal cual.
 */
export async function elegirMejorCalidad(
  generarBlob: (calidad: number) => Promise<Blob | null>,
  techoBytes: number,
  calidades: readonly number[] = CALIDADES_A_PROBAR,
): Promise<Blob> {
  let ultimoBlob: Blob | null = null

  for (const calidad of calidades) {
    const blob = await generarBlob(calidad)
    if (!blob) continue
    ultimoBlob = blob
    if (blob.size <= techoBytes) return blob
  }

  if (!ultimoBlob) throw new ErrorFoto('No se pudo generar la imagen comprimida.')
  return ultimoBlob
}

async function leerUbicacionExif(archivo: Blob): Promise<UbicacionExif | null> {
  try {
    const gps = await exifr.gps(archivo)
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      return { lat: gps.latitude, lon: gps.longitude }
    }
  } catch {
    // EXIF ilegible o ausente: no es un error, simplemente no hay autorrelleno.
  }
  return null
}

async function leerOrientacionExif(archivo: Blob): Promise<number> {
  try {
    const orientacion = await exifr.orientation(archivo)
    return typeof orientacion === 'number' ? orientacion : 1
  } catch {
    return 1
  }
}

/**
 * Procesa una foto elegida por el usuario: valida el archivo, lee su EXIF
 * (solo para devolver la ubicación GPS si la trae, y para orientar bien la
 * salida), y la recodifica comprimida sin metadatos.
 */
export async function procesarFoto(archivo: File): Promise<ResultadoProcesarFoto> {
  if (!archivo.type.startsWith('image/')) {
    throw new ErrorFoto('El archivo elegido no es una imagen.')
  }

  if (archivo.size > TAMANO_MAXIMO_ORIGINAL_BYTES) {
    throw new ErrorFoto('La foto no puede superar 40 MB.')
  }

  const [ubicacionExif, orientacionExif] = await Promise.all([
    leerUbicacionExif(archivo),
    leerOrientacionExif(archivo),
  ])

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(archivo)
  } catch {
    throw new ErrorFoto(
      'No se pudo abrir esta foto (puede que el formato no sea compatible, por ejemplo HEIC, ' +
        'o que la imagen esté dañada). Prueba con otra foto.',
    )
  }

  try {
    const blob = await recomprimirImagen(bitmap, orientacionExif)
    return { blob, ubicacionExif }
  } finally {
    bitmap.close()
  }
}
