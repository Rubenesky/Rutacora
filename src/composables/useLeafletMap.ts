import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createBaseLayers } from './useMapLayers'
import { FOTOS_BUCKET, SIGNED_URL_TTL_SEGUNDOS } from '@/lib/constantes'
import { escapeHtml } from '@/lib/escapeHtml'
import { guardarCapaElegida, leerCapaGuardada } from '@/lib/preferenciaCapaMapa'
import { guardarUrlCacheada, obtenerUrlCacheada } from '@/lib/signedUrlCache'
import { supabase } from '@/lib/supabaseClient'
import type { RutaConEstado } from './useVisibleRoutes'

// Vista inicial centrada en la península, con Baleares y Canarias accesibles
// mediante zoom/paneo (no entran todas a la vez en una vista razonable).
const CENTRO_ESPANA: L.LatLngTuple = [40.0, -3.7]
const ZOOM_INICIAL = 6
const ZOOM_RUTA = 15
const DURACION_VUELO_SEGUNDOS = 1.2

export interface OpcionesLeafletMap {
  onEditarRuta?: (ruta: RutaConEstado) => void
  onBorrarRuta?: (ruta: RutaConEstado) => void
  /** Devuelve el user_id de la sesión activa, o undefined sin sesión. Se
   * llama en cada apertura de popup (no se guarda una copia), así que
   * refleja el estado de login en vivo sin tener que volver a renderizar
   * los marcadores al iniciar/cerrar sesión. */
  obtenerUserIdSesion?: () => string | undefined
}

// Marcador distinguible para rutas que aún están pendientes de sincronizar
// (naranja, en vez del azul por defecto de Leaflet).
const iconoPendiente = L.divIcon({
  className: 'marcador-pendiente',
  html: '<span class="marcador-pendiente-punto"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function popupHtml(ruta: RutaConEstado, conAcciones: boolean): string {
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
function reposicionarPopup(popup: L.Popup): void {
  const interno = popup as unknown as {
    _updateLayout?: () => void
    _updatePosition?: () => void
    _adjustPan?: () => void
  }
  interno._updateLayout?.()
  interno._updatePosition?.()
  interno._adjustPan?.()
}

async function cargarFotoEnPopup(popupEl: HTMLElement, popup: L.Popup): Promise<void> {
  const fotoDiv = popupEl.querySelector<HTMLElement>('.ruta-popup-foto')
  const fotoPath = fotoDiv?.dataset.fotoPath
  if (!fotoDiv || !fotoPath) return

  const urlCacheada = obtenerUrlCacheada(fotoPath)
  if (urlCacheada) {
    mostrarFotoEnDiv(fotoDiv, urlCacheada, popup)
    return
  }

  if (!navigator.onLine) {
    fotoDiv.textContent = 'Foto no disponible sin conexión.'
    return
  }

  const { data, error } = await supabase.storage
    .from(FOTOS_BUCKET)
    .createSignedUrl(fotoPath, SIGNED_URL_TTL_SEGUNDOS)

  if (error || !data) {
    fotoDiv.textContent = 'No se pudo cargar la foto.'
    return
  }

  guardarUrlCacheada(fotoPath, data.signedUrl, SIGNED_URL_TTL_SEGUNDOS)
  mostrarFotoEnDiv(fotoDiv, data.signedUrl, popup)
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

export function useLeafletMap(container: HTMLElement, opciones: OpcionesLeafletMap = {}) {
  const map = L.map(container, {
    center: CENTRO_ESPANA,
    zoom: ZOOM_INICIAL,
    minZoom: 4,
    worldCopyJump: false,
  })

  const baseLayers = createBaseLayers()
  const nombreGuardado = leerCapaGuardada()
  const capaInicial = (nombreGuardado && baseLayers[nombreGuardado]) || Object.values(baseLayers)[0]
  if (capaInicial) capaInicial.addTo(map)
  // "bottomleft": el zoom ocupa arriba-izquierda, la atribución abajo-derecha
  // y los botones de sesión de la app arriba-derecha. Así ningún control se
  // solapa con otro en ningún tamaño de pantalla.
  L.control.layers(baseLayers, undefined, { position: 'bottomleft' }).addTo(map)
  map.on('baselayerchange', (evento) => guardarCapaElegida(evento.name))

  const clusterGroup = L.markerClusterGroup()
  map.addLayer(clusterGroup)

  const marcadoresPorId = new Map<string, L.Marker>()

  function renderRutas(rutas: RutaConEstado[]): void {
    clusterGroup.clearLayers()
    marcadoresPorId.clear()
    for (const ruta of rutas) {
      const marker = L.marker([ruta.lat, ruta.lon], ruta.pendienteSync ? { icon: iconoPendiente } : undefined)
      // Contenido inicial sin acciones: al abrir el popup se regenera con
      // setContent() ya sabiendo si hay sesión (ver más abajo).
      marker.bindPopup(popupHtml(ruta, false))

      // Listener por marcador (no global): así cada popup tiene acceso por
      // closure a su propia "ruta" para las acciones de editar/borrar.
      marker.on('popupopen', (event) => {
        // Editar/borrar solo si hay sesión Y la ruta es del usuario con
        // sesión activa. Se comprueba en vivo (no al renderizar los
        // marcadores), así un login/logout posterior no necesita volver a
        // dibujar nada para que aparezcan o desaparezcan estos botones.
        const sesionUserId = opciones.obtenerUserIdSesion?.()
        const esPropia = Boolean(sesionUserId) && sesionUserId === ruta.user_id
        const conAcciones = esPropia && Boolean(opciones.onEditarRuta || opciones.onBorrarRuta)

        // setContent() (no appendChild + update()): regenera todo el
        // contenido de una vez de forma soportada, evitando que una
        // recolocación posterior borre cambios hechos a mano en el DOM.
        event.popup.setContent(popupHtml(ruta, conAcciones))

        const popupEl = event.popup.getElement()
        if (!popupEl) return

        void cargarFotoEnPopup(popupEl, event.popup)

        if (conAcciones) {
          popupEl
            .querySelector<HTMLButtonElement>('[data-action="editar"]')
            ?.addEventListener('click', () => opciones.onEditarRuta?.(ruta))
          popupEl
            .querySelector<HTMLButtonElement>('[data-action="borrar"]')
            ?.addEventListener('click', () => opciones.onBorrarRuta?.(ruta))
        }
      })
      clusterGroup.addLayer(marker)
      marcadoresPorId.set(ruta.id, marker)
    }
  }

  /**
   * Vuela a la ruta indicada: zoom predecible (ZOOM_RUTA, topado al máximo
   * de la capa activa), compensando el ancho del panel lateral en
   * escritorio para que el punto no quede detrás de él, y abre su popup.
   * Si el marcador está dentro de un cluster colapsado, usa
   * zoomToShowLayer() para desagruparlo primero.
   */
  function flyToRoute(ruta: RutaConEstado, anchoPanelLateralPx = 0): void {
    const marker = marcadoresPorId.get(ruta.id)
    if (!marker) return

    if (clusterGroup.getVisibleParent(marker) !== marker) {
      clusterGroup.zoomToShowLayer(marker, () => marker.openPopup())
      return
    }

    const zoomDestino = Math.min(ZOOM_RUTA, map.getMaxZoom())
    const prefiereMovimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let destino = L.latLng(ruta.lat, ruta.lon)
    if (anchoPanelLateralPx > 0) {
      const punto = map.project(destino, zoomDestino)
      const puntoDesplazado = punto.subtract(L.point(anchoPanelLateralPx / 2, 0))
      destino = map.unproject(puntoDesplazado, zoomDestino)
    }

    if (prefiereMovimientoReducido) {
      map.setView(destino, zoomDestino)
      marker.openPopup()
      return
    }

    map.once('moveend', () => marker.openPopup())
    map.flyTo(destino, zoomDestino, { duration: DURACION_VUELO_SEGUNDOS })
  }

  // --- Selección de ubicación (para el formulario de añadir/editar ruta) ---
  let marcadorSeleccion: L.Marker | null = null
  let onCambioSeleccion: ((lat: number, lon: number) => void) | null = null

  function moverSeleccion(lat: number, lon: number): void {
    marcadorSeleccion?.setLatLng([lat, lon])
  }

  function iniciarSeleccionUbicacion(
    lat: number,
    lon: number,
    onCambio: (lat: number, lon: number) => void,
  ): void {
    onCambioSeleccion = onCambio
    if (marcadorSeleccion) {
      marcadorSeleccion.setLatLng([lat, lon])
    } else {
      marcadorSeleccion = L.marker([lat, lon], { draggable: true }).addTo(map)
      marcadorSeleccion.on('dragend', () => {
        const pos = marcadorSeleccion?.getLatLng()
        if (pos) onCambioSeleccion?.(pos.lat, pos.lng)
      })
    }
  }

  function finalizarSeleccionUbicacion(): void {
    if (marcadorSeleccion) {
      map.removeLayer(marcadorSeleccion)
      marcadorSeleccion = null
    }
    onCambioSeleccion = null
  }

  map.on('click', (event: L.LeafletMouseEvent) => {
    if (!onCambioSeleccion) return
    moverSeleccion(event.latlng.lat, event.latlng.lng)
    onCambioSeleccion(event.latlng.lat, event.latlng.lng)
  })

  function destroy(): void {
    map.remove()
  }

  return {
    map,
    renderRutas,
    destroy,
    iniciarSeleccionUbicacion,
    moverSeleccion,
    finalizarSeleccionUbicacion,
    flyToRoute,
  }
}
