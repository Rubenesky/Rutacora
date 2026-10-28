import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createBaseLayers } from './useMapLayers'
import { crearIconoRuta } from '@/lib/iconosRuta'
import { mismoUsuario } from '@/lib/mismoUsuario'
import { guardarCapaElegida, leerCapaGuardada } from '@/lib/preferenciaCapaMapa'
import { prefiereMovimientoReducido } from '@/lib/prefiereMovimientoReducido'
import { aplicarAccesibilidadPopup, cargarFotoEnPopup, popupHtml } from '@/lib/rutaPopup'
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

// zIndexOffset del marcador con el popup abierto, para que quede por
// encima de los demás (p. ej. un vecino muy cercano en el mismo cluster).
const Z_INDEX_POPUP_ABIERTO = 1000

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
  // El zoom ocupa arriba-izquierda (por defecto). La atribución, por
  // defecto abajo-derecha, se mueve a abajo-izquierda (apilada con el
  // control de capas) para dejar la esquina inferior derecha libre para
  // el botón flotante "Añadir ruta" en móvil. Así ningún control se
  // solapa con otro en ningún tamaño de pantalla.
  map.attributionControl.setPosition('bottomleft')
  L.control.layers(baseLayers, undefined, { position: 'bottomleft' }).addTo(map)
  map.on('baselayerchange', (evento) => guardarCapaElegida(evento.name))

  const clusterGroup = L.markerClusterGroup()
  map.addLayer(clusterGroup)

  // El alto/ancho disponible cambia cuando aparece/desaparece la barra
  // superior, un aviso, o al rotar el dispositivo. ResizeObserver cubre
  // todos esos casos (no solo el resize de la ventana).
  const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize()
  })
  resizeObserver.observe(container)

  const marcadoresPorId = new Map<string, L.Marker>()

  function renderRutas(rutas: RutaConEstado[]): void {
    clusterGroup.clearLayers()
    marcadoresPorId.clear()
    for (const ruta of rutas) {
      const estado = ruta.pendienteSync ? 'pendiente' : 'sincronizada'
      const marker = L.marker([ruta.lat, ruta.lon], {
        icon: crearIconoRuta(estado, ruta.nombre),
        title: ruta.nombre,
      })
      // Contenido inicial sin acciones: al abrir el popup se regenera con
      // setContent() ya sabiendo si hay sesión (ver más abajo).
      marker.bindPopup(popupHtml(ruta, false))

      // El marcador con el popup abierto queda por encima de los vecinos
      // (p. ej. otro muy cercano en el mismo cluster desagrupado).
      marker.on('popupopen', () => marker.setZIndexOffset(Z_INDEX_POPUP_ABIERTO))

      // Limpieza del listener de Escape de aplicarAccesibilidadPopup() (ver
      // abajo); una variable por marcador (cerrada sobre cada iteración del
      // bucle), no compartida entre marcadores.
      let limpiarAccesibilidadPopup: (() => void) | null = null
      marker.on('popupclose', () => {
        marker.setZIndexOffset(0)
        limpiarAccesibilidadPopup?.()
        limpiarAccesibilidadPopup = null
        // Antes el foco se perdía al cerrar (quedaba en el propio DOM del
        // popup, que Leaflet retira) o cambiaba a algo inesperado; sin esto
        // un usuario de teclado se quedaba "perdido" tras cerrar. Se
        // devuelve al propio marcador, que sigue siendo focalizable.
        marker.getElement()?.focus()
      })

      // Listener por marcador (no global): así cada popup tiene acceso por
      // closure a su propia "ruta" para las acciones de editar/borrar.
      marker.on('popupopen', (event) => {
        // Editar/borrar solo si hay sesión Y la ruta es del usuario con
        // sesión activa. Se comprueba en vivo (no al renderizar los
        // marcadores), así un login/logout posterior no necesita volver a
        // dibujar nada para que aparezcan o desaparezcan estos botones.
        const sesionUserId = opciones.obtenerUserIdSesion?.()
        const esPropia = mismoUsuario(sesionUserId, ruta.user_id)
        const conAcciones = esPropia && Boolean(opciones.onEditarRuta || opciones.onBorrarRuta)

        // setContent() (no appendChild + update()): regenera todo el
        // contenido de una vez de forma soportada, evitando que una
        // recolocación posterior borre cambios hechos a mano en el DOM.
        event.popup.setContent(popupHtml(ruta, conAcciones))

        const popupEl = event.popup.getElement()
        if (!popupEl) return

        // Accesibilidad: role="dialog" + aria-labelledby, mueve el foco al
        // título y cierra con Escape (antes nada de esto pasaba — ver
        // aplicarAccesibilidadPopup en rutaPopup.ts para el porqué).
        limpiarAccesibilidadPopup = aplicarAccesibilidadPopup(popupEl, () => marker.closePopup())

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

  /** Vuelve a la vista inicial (centro de España, zoom de arranque), igual
   * que al cargar la app por primera vez. Respeta prefers-reduced-motion,
   * igual que flyToRoute. */
  function reiniciarVista(): void {
    if (prefiereMovimientoReducido()) {
      map.setView(CENTRO_ESPANA, ZOOM_INICIAL)
    } else {
      map.flyTo(CENTRO_ESPANA, ZOOM_INICIAL, { duration: DURACION_VUELO_SEGUNDOS })
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

    let destino = L.latLng(ruta.lat, ruta.lon)
    if (anchoPanelLateralPx > 0) {
      const punto = map.project(destino, zoomDestino)
      const puntoDesplazado = punto.subtract(L.point(anchoPanelLateralPx / 2, 0))
      destino = map.unproject(puntoDesplazado, zoomDestino)
    }

    if (prefiereMovimientoReducido()) {
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
      marcadorSeleccion = L.marker([lat, lon], {
        draggable: true,
        icon: crearIconoRuta('seleccion'),
        title: 'Ubicación de la ruta',
      }).addTo(map)
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
    resizeObserver.disconnect()
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
    reiniciarVista,
  }
}
