import L from 'leaflet'
import { escapeHtml } from './escapeHtml'

// Única fábrica de iconos de marcador: SVG en línea, sin ninguna imagen de
// archivo. L.Icon.Default (los PNG que trae Leaflet) no sobrevive al build
// de Vite — marker-icon-2x.png y marker-shadow.png nunca llegan a dist/
// (Leaflet los pide construyendo la URL a mano en tiempo de ejecución,
// "imagePath + nombre.png"; Vite solo empaqueta lo que encuentra como
// url() literal en el CSS o como import, así que nunca ve esas dos
// peticiones y no genera esos archivos). En producción, esas peticiones
// las responde el fallback de SPA de Vite/Netlify con el propio
// index.html (200, text/html), y el navegador no puede decodificar eso
// como imagen: icono roto con el texto alternativo "Mark...". Confirmado
// reproduciendo con npm run build + npm run preview antes de este cambio.
export type EstadoIconoRuta = 'sincronizada' | 'pendiente' | 'seleccion'

const COLOR_POR_ESTADO: Record<EstadoIconoRuta, string> = {
  // Rojo: destaca sobre caminos/carreteras en rojo de las capas de mapa
  // (OSM, OpenTopoMap) y sobre el verde de vegetación de IGN/PNOA.
  sincronizada: '#d32f2f',
  pendiente: '#ef6c00',
  seleccion: '#1565c0',
}

const ETIQUETA_POR_ESTADO: Record<EstadoIconoRuta, string> = {
  sincronizada: 'Ruta',
  pendiente: 'Ruta pendiente de sincronizar',
  seleccion: 'Ubicación de la ruta',
}

// Pin clásico (cabeza circular + punta inferior), en un lienzo de 44x56:
// el ancho ya es 44px (área táctil mínima), con margen para la punta y el
// contorno. Punto geográfico = punta inferior (ver iconAnchor).
const ANCHO = 44
const ALTO = 56
const PIN_PATH = 'M22 4C12.059 4 4 12.059 4 22c0 12 18 32 18 32s18-20 18-32C40 12.059 31.941 4 22 4Z'
// Centro de la cabeza del pin, para los símbolos interiores y popupAnchor.
const CENTRO_CABEZA_X = 22
const CENTRO_CABEZA_Y = 21

function simboloInterior(estado: EstadoIconoRuta): string {
  const cx = CENTRO_CABEZA_X
  const cy = CENTRO_CABEZA_Y
  if (estado === 'pendiente') {
    // Reloj: distingue "pendiente" sin depender solo del color (naranja).
    return `
      <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#fff" stroke-width="1.8"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 5.5}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${cx + 4.5}" y2="${cy}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
    `
  }
  if (estado === 'seleccion') {
    // Retícula/diana: símbolo distinto del reloj y del pin liso de ruta,
    // además del color azul (nunca igual que un marcador de ruta).
    return `
      <circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="#fff" stroke-width="1.8"/>
      <line x1="${cx}" y1="${cy - 10}" x2="${cx}" y2="${cy - 6}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy + 6}" x2="${cx}" y2="${cy + 10}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${cx - 10}" y1="${cy}" x2="${cx - 6}" y2="${cy}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${cx + 6}" y1="${cy}" x2="${cx + 10}" y2="${cy}" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
    `
  }
  return ''
}

/** SVG en línea del pin (sin el <div> contenedor): úsalo también en tests
 * para comprobar el color/símbolo sin montar Leaflet. */
export function svgIconoRuta(estado: EstadoIconoRuta): string {
  return (
    `<svg width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">` +
    `<path d="${PIN_PATH}" fill="${COLOR_POR_ESTADO[estado]}" stroke="#fff" stroke-width="2"/>` +
    simboloInterior(estado) +
    '</svg>'
  )
}

/** Fábrica única de iconos de marcador (rutas sincronizadas/pendientes y el
 * punto de selección del formulario). Nunca L.Icon.Default ni imágenes de
 * archivo. `nombre` se usa como title/aria-label (p. ej. el nombre de la
 * ruta); por defecto, una etiqueta genérica según el estado. */
export function crearIconoRuta(estado: EstadoIconoRuta, nombre?: string): L.DivIcon {
  const etiqueta = nombre ?? ETIQUETA_POR_ESTADO[estado]
  const html =
    // min-width/min-height en el contenedor (ver estilos globales en
    // style.css) garantizan el área táctil de 44x44, aunque el SVG visible
    // sea más estrecho en su parte baja.
    `<div role="img" aria-label="${escapeHtml(etiqueta)}">${svgIconoRuta(estado)}</div>`

  return L.divIcon({
    className: `icono-ruta icono-ruta--${estado}`,
    html,
    iconSize: [ANCHO, ALTO],
    // Punta inferior del pin = el punto geográfico exacto.
    iconAnchor: [ANCHO / 2, ALTO - 2],
    // Encima de la cabeza del pin (no del contenedor completo), para que
    // el popup no tape el icono ni quede pegado a él.
    popupAnchor: [0, -(ALTO - 2 - CENTRO_CABEZA_Y) - 8],
  })
}
