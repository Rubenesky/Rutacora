import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createBaseLayers } from './useMapLayers'
import { escapeHtml } from '@/lib/escapeHtml'
import { supabase } from '@/lib/supabaseClient'
import type { Ruta } from '@/types/database.types'

// Vista inicial centrada en la península, con Baleares y Canarias accesibles
// mediante zoom/paneo (no entran todas a la vez en una vista razonable).
const CENTRO_ESPANA: L.LatLngTuple = [40.0, -3.7]
const ZOOM_INICIAL = 6

const FOTOS_BUCKET = 'fotos-rutas'
const SIGNED_URL_TTL_SEGUNDOS = 60 * 60

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

export function useLeafletMap(container: HTMLElement) {
  const map = L.map(container, {
    center: CENTRO_ESPANA,
    zoom: ZOOM_INICIAL,
    minZoom: 4,
    worldCopyJump: false,
  })

  const baseLayers = createBaseLayers()
  const primeraCapa = Object.values(baseLayers)[0]
  if (primeraCapa) primeraCapa.addTo(map)
  L.control.layers(baseLayers).addTo(map)

  const clusterGroup = L.markerClusterGroup()
  map.addLayer(clusterGroup)

  map.on('popupopen', (event) => {
    const popupEl = event.popup.getElement()
    if (popupEl) void cargarFotoEnPopup(popupEl)
  })

  function renderRutas(rutas: Ruta[]): void {
    clusterGroup.clearLayers()
    for (const ruta of rutas) {
      const marker = L.marker([ruta.lat, ruta.lon])
      marker.bindPopup(popupHtml(ruta))
      clusterGroup.addLayer(marker)
    }
  }

  function destroy(): void {
    map.remove()
  }

  return { map, renderRutas, destroy }
}
