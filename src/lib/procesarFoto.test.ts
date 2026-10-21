import { createCanvas } from 'canvas'
import exifr from 'exifr'
import { describe, expect, it } from 'vitest'
import {
  LADO_MAXIMO_PX,
  calcularDimensiones,
  elegirMejorCalidad,
  procesarFoto,
  recomprimirImagen,
} from './procesarFoto'

function canvasABlob(ancho: number, alto: number, pintar: (ctx: CanvasRenderingContext2D) => void): Promise<Blob> {
  const canvas = createCanvas(ancho, alto)
  const ctx = canvas.getContext('2d')
  pintar(ctx as unknown as CanvasRenderingContext2D)
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 })
  return Promise.resolve(new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }))
}

function leerPixel(datosImagen: ImageData, x: number, y: number): [number, number, number] {
  const i = (y * datosImagen.width + x) * 4
  return [datosImagen.data[i] ?? 0, datosImagen.data[i + 1] ?? 0, datosImagen.data[i + 2] ?? 0]
}

// La recompresión JPEG difumina ligeramente los bordes (chroma subsampling),
// así que se compara con tolerancia en vez de un valor exacto.
function esAproximadamente(color: [number, number, number], esperado: [number, number, number]): boolean {
  return color.every((canal, i) => Math.abs(canal - (esperado[i] ?? 0)) <= 15)
}

describe('calcularDimensiones', () => {
  it('reduce manteniendo proporción cuando el lado largo supera el máximo', () => {
    const { ancho, alto } = calcularDimensiones(3000, 2000, 1600)
    expect(ancho).toBe(1600)
    expect(alto).toBe(1067)
  })

  it('no amplía una imagen que ya es más pequeña que el máximo', () => {
    expect(calcularDimensiones(800, 600, 1600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('respeta el máximo también cuando el lado largo es la altura', () => {
    const { ancho, alto } = calcularDimensiones(2000, 3000, 1600)
    expect(alto).toBe(1600)
    expect(ancho).toBe(1067)
  })
})

describe('elegirMejorCalidad', () => {
  it('se queda con la primera calidad que respeta el techo (prioriza la calidad)', async () => {
    const tamanos = [700_000, 550_000, 300_000]
    let llamadas = 0
    const blob = await elegirMejorCalidad(
      async () => {
        const tamano = tamanos[llamadas]
        llamadas += 1
        return new Blob([new Uint8Array(tamano ?? 0)])
      },
      500_000,
      [0.8, 0.6, 0.4],
    )

    expect(llamadas).toBe(3)
    expect(blob.size).toBe(300_000)
  })

  it('si ninguna respeta el techo, no persigue un peso exacto: usa la última probada', async () => {
    const tamanos = [900_000, 800_000, 700_000]
    let llamadas = 0
    const blob = await elegirMejorCalidad(
      async () => {
        const tamano = tamanos[llamadas]
        llamadas += 1
        return new Blob([new Uint8Array(tamano ?? 0)])
      },
      500_000,
      [0.8, 0.6, 0.4],
    )

    expect(llamadas).toBe(3)
    expect(blob.size).toBe(700_000)
  })

  it('no prueba más calidades de las necesarias si la primera ya es suficiente', async () => {
    let llamadas = 0
    await elegirMejorCalidad(
      async () => {
        llamadas += 1
        return new Blob([new Uint8Array(100_000)])
      },
      500_000,
      [0.8, 0.6, 0.4],
    )

    expect(llamadas).toBe(1)
  })
})

describe('recomprimirImagen: orientación y redimensionado', () => {
  it('con orientación 6 (foto vertical), intercambia ancho/alto y rota el contenido', async () => {
    // Imagen "en bruto" de 40x30 (como la guardaría la cámara tumbada) con
    // una marca roja en la esquina superior-izquierda bruta; el resto blanco.
    // Timeout ampliado: codificación real con node-canvas, lenta bajo
    // contención cuando corre toda la suite (ya mucho más grande) en paralelo.
    const anchoBruto = 40
    const altoBruto = 30
    const canvasFuente = createCanvas(anchoBruto, altoBruto)
    const ctxFuente = canvasFuente.getContext('2d')
    ctxFuente.fillStyle = 'white'
    ctxFuente.fillRect(0, 0, anchoBruto, altoBruto)
    ctxFuente.fillStyle = 'red'
    ctxFuente.fillRect(0, 0, 10, 10)

    const blob = await recomprimirImagen(
      canvasFuente as unknown as CanvasImageSource & { width: number; height: number },
      6,
    )

    const bitmap = await createImageBitmap(blob)
    // Orientación 6 implica giro de 90°: la salida debe quedar vertical.
    expect(bitmap.width).toBe(altoBruto)
    expect(bitmap.height).toBe(anchoBruto)

    const canvasSalida = createCanvas(bitmap.width, bitmap.height)
    const ctxSalida = canvasSalida.getContext('2d')
    ;(ctxSalida.drawImage as (imagen: unknown, x: number, y: number) => void)(bitmap, 0, 0)
    const datos = ctxSalida.getImageData(0, 0, bitmap.width, bitmap.height)

    // La marca (roja) debe haber girado a la esquina superior-derecha (se
    // muestrea 2px dentro del borde para evitar el difuminado propio de la
    // recompresión JPEG justo en el límite del canvas).
    expect(esAproximadamente(leerPixel(datos as unknown as ImageData, bitmap.width - 3, 2), [255, 0, 0])).toBe(
      true,
    )
    // La esquina superior-izquierda, que en bruto era roja, ya no debe serlo.
    expect(esAproximadamente(leerPixel(datos as unknown as ImageData, 2, 2), [255, 255, 255])).toBe(true)
  }, 60_000)

  it('redimensiona respetando el máximo de 1600px en el lado largo', async () => {
    const canvasFuente = createCanvas(3000, 2000)
    const ctxFuente = canvasFuente.getContext('2d')
    ctxFuente.fillStyle = 'green'
    ctxFuente.fillRect(0, 0, 3000, 2000)

    const blob = await recomprimirImagen(
      canvasFuente as unknown as CanvasImageSource & { width: number; height: number },
      1,
    )
    const bitmap = await createImageBitmap(blob)

    expect(Math.max(bitmap.width, bitmap.height)).toBe(LADO_MAXIMO_PX)
    expect(bitmap.width).toBe(1600)
    expect(bitmap.height).toBe(1067)
  })
})

describe('recomprimirImagen: sin EXIF en la salida', () => {
  it('el blob recodificado no contiene GPS ni marcador APP1', async () => {
    const canvasFuente = createCanvas(100, 80)
    const ctxFuente = canvasFuente.getContext('2d')
    ctxFuente.fillStyle = 'blue'
    ctxFuente.fillRect(0, 0, 100, 80)

    const blob = await recomprimirImagen(
      canvasFuente as unknown as CanvasImageSource & { width: number; height: number },
      1,
    )

    const gps = await exifr.gps(blob)
    expect(gps).toBeUndefined()

    const bytes = new Uint8Array(await blob.arrayBuffer())
    let tieneApp1 = false
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
        tieneApp1 = true
        break
      }
    }
    expect(tieneApp1).toBe(false)
  })
})

describe('procesarFoto: validación de entrada', () => {
  it('rechaza un archivo que no es una imagen', async () => {
    const archivo = new File([new Uint8Array(10)], 'nota.txt', { type: 'text/plain' })
    await expect(procesarFoto(archivo)).rejects.toThrow(/no es una imagen/)
  })

  it('rechaza un original de más de 40 MB', async () => {
    const archivo = new File([new Uint8Array(41 * 1024 * 1024)], 'enorme.jpg', { type: 'image/jpeg' })
    await expect(procesarFoto(archivo)).rejects.toThrow(/40 MB/)
  })

  it('muestra un error claro si el navegador no puede decodificar la imagen', async () => {
    const archivo = new File([new Uint8Array([1, 2, 3, 4, 5])], 'rota.heic', { type: 'image/heic' })
    await expect(procesarFoto(archivo)).rejects.toThrow(/no se pudo abrir/i)
  })

  it('procesa una imagen válida y devuelve blob + ubicación EXIF (null si no trae GPS)', async () => {
    const blobFuente = await canvasABlob(200, 150, (ctx) => {
      ctx.fillStyle = 'orange'
      ctx.fillRect(0, 0, 200, 150)
    })
    const archivo = new File([blobFuente], 'foto.jpg', { type: 'image/jpeg' })

    const resultado = await procesarFoto(archivo)

    expect(resultado.blob.type).toBe('image/jpeg')
    expect(resultado.ubicacionExif).toBeNull()
  })
})
