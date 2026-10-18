import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createBaseLayers } from './useMapLayers'
import { escapeHtml } from '@/lib/escapeHtml'
import { guardarCapaElegida, leerCapaGuardada } from '@/lib/preferenciaCapaMapa'
import { supabase } from '@/lib/supabaseClient'
import type { Ruta } from '@/types/database.types'

// Vista inicial centrada en la península, con Baleares y Canarias accesibles
// mediante zoom/paneo (no entran todas a la vez en una vista razonable).
const CENTRO_ESPANA: L.LatLngTuple = [40.0, -3.7]
const ZOOM_INICIAL = 6

const FOTOS_BUCKET = 'fotos-rutas'
const SIGNED_URL_TTL_SEGUNDOS = 60 * 60

export interface OpcionesLeafletMap {
  onEditarRuta?: (ruta: Ruta) => void
  onBorrarRuta?: (ruta: Ruta) => void
}

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function popupHtml(ruta: Ruta): string {
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
      ${ruta.notas ? `<p class="ruta-popup-notas">${escapeHtml(ruta.notas)}</p>` : ''}
      <div class="ruta-popup-foto" data-foto-path="${ruta.foto_path ? escapeHtml(ruta.foto_path) : ''}">
        ${ruta.foto_path ? 'Cargando foto…' : ''}
      </div>
      <div class="ruta-popup-acciones">
        <button type="button" data-action="editar">Editar</button>
        <button type="button" data-action="borrar">Borrar</button>
      </div>
    </div>
  `
}

async function cargarFotoEnPopup(popupEl: HTMLElement): Promise<void> {
  const fotoDiv = popupEl.querySelector<HTMLElement>('.ruta-popup-foto')
  const fotoPath = fotoDiv?.dataset.fotoPath
  if (!fotoDiv || !fotoPath) return

  const { data, error } = await supabase.storage
    .from(FOTOS_BUCKET)
    .createSignedUrl(fotoPath, SIGNED_URL_TTL_SEGUNDOS)

  if (error || !data) {
    fotoDiv.textContent = 'No se pudo cargar la foto.'
    return
  }

  const img = document.createElement('img')
  img.src = data.signedUrl
  img.alt = 'Foto de la ruta'
  img.loading = 'lazy'
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
  // y el botón "Salir" de la app arriba-derecha. Así ningún control se solapa
  // con otro en ningún tamaño de pantalla.
  L.control.layers(baseLayers, undefined, { position: 'bottomleft' }).addTo(map)
  map.on('baselayerchange', (evento) => guardarCapaElegida(evento.name))

  const clusterGroup = L.markerClusterGroup()
  map.addLayer(clusterGroup)

  function renderRutas(rutas: Ruta[]): void {
    clusterGroup.clearLayers()
    for (const ruta of rutas) {
      const marker = L.marker([ruta.lat, ruta.lon])
      marker.bindPopup(popupHtml(ruta))
      // Listener por marcador (no global): así cada popup tiene acceso por
      // closure a su propia "ruta" para las acciones de editar/borrar.
      marker.on('popupopen', (event) => {
        const popupEl = event.popup.getElement()
        if (!popupEl) return

        void cargarFotoEnPopup(popupEl)

        popupEl
          .querySelector<HTMLButtonElement>('[data-action="editar"]')
          ?.addEventListener('click', () => opciones.onEditarRuta?.(ruta))
        popupEl
          .querySelector<HTMLButtonElement>('[data-action="borrar"]')
          ?.addEventListener('click', () => opciones.onBorrarRuta?.(ruta))
      })
      clusterGroup.addLayer(marker)
    }
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
  }
}
