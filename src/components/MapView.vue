<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useVisibleRoutes, type RutaConEstado } from '@/composables/useVisibleRoutes'
import { useOfflineQueue, type AccionFoto, type GuardarRutaInput } from '@/composables/useOfflineQueue'
import RouteFormModal from './RouteFormModal.vue'
import RouteListPanel from './RouteListPanel.vue'
import type { Ruta } from '@/types/database.types'

const mapContainer = ref<HTMLElement | null>(null)
const { rutasVisibles, isLoading, errorMessage, fetchRutas } = useVisibleRoutes()
const { saveRoute, deleteRoute } = useOfflineQueue()

let leafletMap: ReturnType<typeof useLeafletMap> | null = null

const formAbierto = ref(false)
const formInicial = ref<Ruta | null>(null)
const seleccionLat = ref<number | null>(null)
const seleccionLon = ref<number | null>(null)
// true si la ubicación ya viene de una edición existente, o si el usuario la
// ha fijado a mano/mapa/geolocalización durante esta sesión del formulario.
// Mientras sea false, una foto con GPS en el EXIF puede autorrellenarla.
const ubicacionElegida = ref(false)

const panelRutasAbierto = ref(false)

function onEditarRuta(ruta: RutaConEstado): void {
  abrirFormulario(ruta)
}

function onBorrarRuta(ruta: RutaConEstado): void {
  const confirmado = window.confirm(`¿Borrar "${ruta.nombre}"? Esta acción no se puede deshacer.`)
  if (!confirmado) return
  void borrarRuta(ruta)
}

onMounted(async () => {
  if (mapContainer.value) {
    leafletMap = useLeafletMap(mapContainer.value, { onEditarRuta, onBorrarRuta })
  }
  await fetchRutas()
})

watch(rutasVisibles, (nuevasRutas) => {
  leafletMap?.renderRutas(nuevasRutas)
})

watch([seleccionLat, seleccionLon], ([lat, lon]) => {
  if (lat !== null && lon !== null) leafletMap?.moverSeleccion(lat, lon)
})

function abrirFormulario(ruta: Ruta | null): void {
  formInicial.value = ruta
  ubicacionElegida.value = ruta !== null
  const centro = leafletMap?.map.getCenter()
  seleccionLat.value = ruta?.lat ?? centro?.lat ?? null
  seleccionLon.value = ruta?.lon ?? centro?.lng ?? null
  formAbierto.value = true

  if (seleccionLat.value !== null && seleccionLon.value !== null) {
    leafletMap?.iniciarSeleccionUbicacion(seleccionLat.value, seleccionLon.value, (lat, lon) => {
      seleccionLat.value = lat
      seleccionLon.value = lon
      ubicacionElegida.value = true
    })
  }
}

function cerrarFormulario(): void {
  formAbierto.value = false
  formInicial.value = null
  leafletMap?.finalizarSeleccionUbicacion()
}

async function onGuardarFormulario(payload: GuardarRutaInput, accionFoto: AccionFoto): Promise<void> {
  const id = payload.id ?? crypto.randomUUID()
  const fotoPathExistente = formInicial.value?.foto_path ?? null

  cerrarFormulario()

  // La lista visible (rutasVisibles) ya refleja este guardado al instante
  // a través de la cola offline (useVisibleRoutes fusiona "pendientes" con
  // la última lista descargada/cacheada), haya red o no.
  await saveRoute({ ...payload, id }, accionFoto, fotoPathExistente)
  await fetchRutas()
}

async function borrarRuta(ruta: RutaConEstado): Promise<void> {
  await deleteRoute(ruta.id, ruta.foto_path)
  await fetchRutas()
}

function onSeleccionarRutaDeLista(ruta: RutaConEstado): void {
  const esEscritorio = window.matchMedia('(min-width: 768px)').matches
  if (!esEscritorio) panelRutasAbierto.value = false
  leafletMap?.centrarYAbrirRuta(ruta.id)
}

onUnmounted(() => {
  leafletMap?.destroy()
})
</script>

<template>
  <div class="map-view">
    <div
      v-if="errorMessage"
      class="map-banner map-banner--error"
      role="alert"
    >
      {{ errorMessage }}
    </div>
    <div
      v-else-if="isLoading"
      class="map-banner"
    >
      Cargando rutas…
    </div>

    <div
      ref="mapContainer"
      class="map-container"
    />

    <div class="map-actions">
      <button
        type="button"
        class="boton-anadir"
        @click="abrirFormulario(null)"
      >
        + Añadir ruta
      </button>
      <button
        type="button"
        class="boton-rutas"
        @click="panelRutasAbierto = true"
      >
        Rutas
      </button>
    </div>
  </div>

  <RouteFormModal
    v-if="formAbierto"
    v-model:lat="seleccionLat"
    v-model:lon="seleccionLon"
    :inicial="formInicial"
    :ubicacion-ya-elegida="ubicacionElegida"
    @cerrar="cerrarFormulario"
    @guardar="onGuardarFormulario"
    @ubicacion-elegida-por-usuario="ubicacionElegida = true"
  />

  <RouteListPanel
    :abierto="panelRutasAbierto"
    :rutas="rutasVisibles"
    @cerrar="panelRutasAbierto = false"
    @seleccionar="onSeleccionarRutaDeLista"
  />
</template>

<style scoped>
.map-view {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-container {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.map-actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.boton-anadir {
  flex: 2;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}

.boton-rutas {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-weight: 600;
  font-size: 16px;
}

.map-banner {
  position: absolute;
  z-index: 1000;
  top: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-1) var(--space-2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.map-banner--error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
</style>
