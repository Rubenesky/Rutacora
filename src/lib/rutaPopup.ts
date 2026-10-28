import type L from 'leaflet'
import { escapeHtml } from './escapeHtml'
import { obtenerUrlFoto } from './obtenerUrlFoto'
import type { RutaConEstado } from '@/composables/useVisibleRoutes'

// Extraído de useLeafletMap.ts: todo lo específico del CONTENIDO del
// popup (plantilla HTML, foto, accesibilidad) vive aquí, separado del
// estado del mapa/capas/navegación. useLeafletMap.ts sigue siendo el
// único que importa este módulo.

// Exportada: también la usa RouteListPanel.vue (antes tenía su propia
// copia idéntica).
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

export function popupHtml(ruta: RutaConEstado, conAcciones: boolean): string {
  const tipo = ruta.tipo === 'circular' ? 'Circular' : ruta.tipo === 'lineal' ? 'Lineal' : '—'
  const desnivel = ruta.desnivel_m != null ? `${ruta.desnivel_m} m` : '—'
  const duracion = ruta.duracion_min != null ? `${ruta.duracion_min} min` : '—'

  return `
    <div class="ruta-popup" data-ruta-id="${escapeHtml(ruta.id)}">
      <h3>${escapeHtml(ruta.nombre)}</h3>
      <dl>
        <dt>Distancia</dt><dd>${ruta.distancia_km} km</dd>
        <dt>Desnivel</dt><dd>${desnivel}</dd>
        <dt>Duración</dt><dd>${duracion}</dd>
        <dt>Tipo</dt><dd>${tipo}</dd>
        <dt>Fecha</dt><dd>${formatearFecha(ruta.fecha)}</dd>
        <dt>Dificultad</dt><dd>${escapeHtml(ruta.dificultad)}</dd>
      </dl>
      ${ruta.pendienteSync ? '<p class="ruta-popup-pendiente">Pendiente de sincronizar</p>' : ''}
      ${ruta.notas ? `<p class="ruta-popup-notas">${escapeHtml(ruta.notas)}</p>` : ''}
      <div class="ruta-popup-foto" data-foto-path="${ruta.foto_path ? escapeHtml(ruta.foto_path) : ''}">
        ${ruta.foto_path ? 'Cargando foto…' : ''}
      </div>
      ${
        conAcciones
          ? '<div class="ruta-popup-acciones">' +
            '<button type="button" data-action="editar">Editar</button>' +
            '<button type="button" data-action="borrar">Borrar</button>' +
            '</div>'
          : ''
      }
    </div>
  `
}

/**
 * Recoloca el popup (tamaño + posición + autoPan) sin regenerar su
 * contenido. Popup.update() público SÍ regenera el contenido desde el
 * string original (sobrescribiendo cualquier cambio manual del DOM, como
 * la foto que se inserta después de cargar), así que aquí se llama solo a
 * los pasos internos de recolocación, igual que hace update() salvo la
 * regeneración de contenido.
 */
export function reposicionarPopup(popup: L.Popup): void {
  const interno = popup as unknown as {
    _updateLayout?: () => void
    _updatePosition?: () => void
    _adjustPan?: () => void
  }
  interno._updateLayout?.()
  interno._updatePosition?.()
  interno._adjustPan?.()
}

function mostrarFotoEnDiv(fotoDiv: HTMLElement, url: string, popup: L.Popup): void {
  const img = document.createElement('img')
  img.alt = 'Foto de la ruta'
  img.loading = 'lazy'
  // El alto del popup cambia cuando la foto termina de cargar (antes solo
  // tenía el texto "Cargando foto…"), así que hay que recolocarlo o puede
  // quedar cortado contra el borde del mapa. reposicionarPopup() hace solo
  // eso, sin tocar el contenido (a diferencia de popup.update()).
  img.onload = () => reposicionarPopup(popup)
  img.src = url
  fotoDiv.replaceChildren(img)
}

export async function cargarFotoEnPopup(popupEl: HTMLElement, popup: L.Popup): Promise<void> {
  const fotoDiv = popupEl.querySelector<HTMLElement>('.ruta-popup-foto')
  const fotoPath = fotoDiv?.dataset.fotoPath
  if (!fotoDiv || !fotoPath) return

  const url = await obtenerUrlFoto(fotoPath)
  if (!url) {
    fotoDiv.textContent = navigator.onLine
      ? 'No se pudo cargar la foto.'
      : 'Foto no disponible sin conexión.'
    return
  }

  mostrarFotoEnDiv(fotoDiv, url, popup)
}

/**
 * Accesibilidad del popup al abrirlo: antes no se anunciaba, el foco no
 * entraba y Escape no lo cerraba (auditoría de accesibilidad, hallazgo
 * crítico #1). role="dialog" + aria-labelledby dan nombre al diálogo;
 * mover el foco al título hace que un lector de pantalla lo anuncie y que
 * Tab empiece dentro del popup en vez de seguir recorriendo los demás
 * marcadores del mapa; el listener de Escape (local a este popup, no
 * global) lo cierra igual que lo haría un <dialog> nativo.
 *
 * Devuelve una función de limpieza que quita el listener de Escape; hay
 * que llamarla en popupclose para no dejar el listener colgado si el
 * popup se cierra por otra vía (el botón ×, otro marcador, etc.).
 */
export function aplicarAccesibilidadPopup(popupEl: HTMLElement, onEscape: () => void): () => void {
  const rutaPopupEl = popupEl.querySelector<HTMLElement>('.ruta-popup')
  const titulo = rutaPopupEl?.querySelector<HTMLElement>('h3')
  if (!rutaPopupEl || !titulo) return () => {}

  const idTitulo = `popup-titulo-${rutaPopupEl.dataset.rutaId ?? ''}`
  titulo.id = idTitulo
  titulo.tabIndex = -1
  rutaPopupEl.setAttribute('role', 'dialog')
  rutaPopupEl.setAttribute('aria-labelledby', idTitulo)

  titulo.focus()

  function onKeydown(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      onEscape()
    }
  }
  rutaPopupEl.addEventListener('keydown', onKeydown)

  return () => rutaPopupEl.removeEventListener('keydown', onKeydown)
}
