<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useRoutes } from '@/composables/useRoutes'
import { useOfflineQueue, type GuardarRutaInput } from '@/composables/useOfflineQueue'
import RouteFormModal from './RouteFormModal.vue'
import type { Ruta } from '@/types/database.types'

const mapContainer = ref<HTMLElement | null>(null)
const { rutas, isLoading, errorMessage, fetchRutas } = useRoutes()
const { saveRoute, deleteRoute } = useOfflineQueue()

let leafletMap: ReturnType<typeof useLeafletMap> | null = null

const formAbierto = ref(false)
const formInicial = ref<Ruta | null>(null)
const seleccionLat = ref<number | null>(null)
const seleccionLon = ref<number | null>(null)

function onEditarRuta(ruta: Ruta): void {
  abrirFormulario(ruta)
}

function onBorrarRuta(ruta: Ruta): void {
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

watch(rutas, (nuevasRutas) => {
  leafletMap?.renderRutas(nuevasRutas)
})

watch([seleccionLat, seleccionLon], ([lat, lon]) => {
  if (lat !== null && lon !== null) leafletMap?.moverSeleccion(lat, lon)
})

function abrirFormulario(ruta: Ruta | null): void {
  formInicial.value = ruta
  const centro = leafletMap?.map.getCenter()
  seleccionLat.value = ruta?.lat ?? centro?.lat ?? null
  seleccionLon.value = ruta?.lon ?? centro?.lng ?? null
  formAbierto.value = true

  if (seleccionLat.value !== null && seleccionLon.value !== null) {
    leafletMap?.iniciarSeleccionUbicacion(seleccionLat.value, seleccionLon.value, (lat, lon) => {
      seleccionLat.value = lat
      seleccionLon.value = lon
    })
  }
}

function cerrarFormulario(): void {
  formAbierto.value = false
  formInicial.value = null
  leafletMap?.finalizarSeleccionUbicacion()
}

function aRutaCompleta(payload: GuardarRutaInput, id: string): Ruta {
  return {
    id,
    user_id: '',
    nombre: payload.nombre,
    lat: payload.lat,
    lon: payload.lon,
    distancia_km: payload.distancia_km,
    desnivel_m: payload.desnivel_m,
    duracion_min: payload.duracion_min,
    tipo: payload.tipo,
    fecha: payload.fecha,
    dificultad: payload.dificultad,
    notas: payload.notas,
    foto_path: null,
    created_at: new Date().toISOString(),
  }
}

async function onGuardarFormulario(payload: GuardarRutaInput): Promise<void> {
  const id = payload.id ?? crypto.randomUUID()

  // Actualización optimista: el marcador aparece/se actualiza al instante,
  // haya red o no. Con red, fetchRutas() la confirma enseguida con los
  // datos reales; sin red, se queda así hasta que la cola sincronice.
  const optimista = aRutaCompleta(payload, id)
  const yaExiste = rutas.value.some((r) => r.id === id)
  rutas.value = yaExiste
    ? rutas.value.map((r) => (r.id === id ? optimista : r))
    : [optimista, ...rutas.value]

  cerrarFormulario()

  await saveRoute({ ...payload, id }, null)
  await fetchRutas()
}

async function borrarRuta(ruta: Ruta): Promise<void> {
  rutas.value = rutas.value.filter((r) => r.id !== ruta.id)
  await deleteRoute(ruta.id, ruta.foto_path)
  await fetchRutas()
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
    </div>
  </div>

  <RouteFormModal
    v-if="formAbierto"
    v-model:lat="seleccionLat"
    v-model:lon="seleccionLon"
    :inicial="formInicial"
    @cerrar="cerrarFormulario"
    @guardar="onGuardarFormulario"
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
  padding: var(--space-2);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.boton-anadir {
  width: 100%;
  background: var(--color-primary);
  color: #fff;
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
