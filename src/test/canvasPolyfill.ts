// SOLO para tests: jsdom no implementa un canvas 2D real ni createImageBitmap,
// así que se delega en node-canvas (que sí renderiza JPEG/PNG de verdad) para
// poder verificar compresión, redimensionado y orientación con salidas reales.
// Nunca se importa desde código de producción.
import { Canvas, Image as CanvasImage, type Image } from 'canvas'

interface CanvasConNodeCanvas extends HTMLCanvasElement {
  _nodeCanvas?: Canvas
}

function obtenerNodeCanvas(el: CanvasConNodeCanvas): Canvas {
  if (!el._nodeCanvas || el._nodeCanvas.width !== el.width || el._nodeCanvas.height !== el.height) {
    el._nodeCanvas = new Canvas(el.width || 300, el.height || 150)
  }
  return el._nodeCanvas
}

HTMLCanvasElement.prototype.getContext = function (this: CanvasConNodeCanvas, tipo: string) {
  if (tipo !== '2d') return null
  return obtenerNodeCanvas(this).getContext('2d') as unknown as CanvasRenderingContext2D
} as typeof HTMLCanvasElement.prototype.getContext

HTMLCanvasElement.prototype.toBlob = function (
  this: CanvasConNodeCanvas,
  callback: BlobCallback,
  type = 'image/png',
  quality?: number,
) {
  const nodeCanvas = obtenerNodeCanvas(this)
  const mime = type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  // Los tipos de node-canvas tienen sobrecargas muy estrictas por mime, y
  // toBuffer necesita conservar su "this" (no se puede extraer a una
  // variable suelta); esto es solo interoperabilidad de test.
  const opts = mime === 'image/jpeg' ? { quality: quality ?? 0.92 } : undefined
  const buffer: Buffer = (nodeCanvas.toBuffer as (mime: string, opts?: { quality: number }) => Buffer).call(
    nodeCanvas,
    mime,
    opts,
  )
  callback(new Blob([new Uint8Array(buffer)], { type: mime }))
}

// Polyfill mínimo de createImageBitmap a partir de un Blob, usando el
// decodificador real de node-canvas.
;(globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap = async function (
  fuente: ImageBitmapSource,
): Promise<ImageBitmap> {
  if (!(fuente instanceof Blob)) {
    throw new Error('Polyfill de createImageBitmap: solo se soporta Blob en tests.')
  }
  const buffer = Buffer.from(await fuente.arrayBuffer())
  const imagen: Image = new CanvasImage()
  await new Promise<void>((resolve, reject) => {
    imagen.onload = () => resolve()
    imagen.onerror = (err) => reject(err instanceof Error ? err : new Error(String(err)))
    imagen.src = buffer
  })

  // Importante: se devuelve la propia imagen de node-canvas (no un objeto
  // plano), porque ctx.drawImage() de node-canvas necesita una fuente de
  // dibujo real (Image/Canvas), no solo un objeto con width/height.
  ;(imagen as unknown as { close: () => void }).close = () => {}
  return imagen as unknown as ImageBitmap
}
