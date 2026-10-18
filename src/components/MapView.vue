<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useVisibleRoutes, type RutaConEstado } from '@/composables/useVisibleRoutes'
import { useOfflineQueue, type AccionFoto, type GuardarRutaInput } from '@/composables/useOfflineQueue'
import { ANCHO_BREAKPOINT_ESCRITORIO_PX, ANCHO_PANEL_RUTAS_PX } from '@/lib/constantes'
import LoginModal from './LoginModal.vue'
import RouteFormModal from './RouteFormModal.vue'
import RouteListPanel from './RouteListPanel.vue'
import type { Ruta } from '@/types/database.types'

const mapContainer = ref<HTMLElement | null>(null)
const { rutasVisibles, isLoading, errorMessage, fetchRutas } = useVisibleRoutes()
const { saveRoute, deleteRoute } = useOfflineQueue()
const { session, logout } = useAuth()

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
const loginAbierto = ref(false)

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
    leafletMap = useLeafletMap(mapContainer.value, {
      onEditarRuta,
      onBorrarRuta,
      obtenerUserIdSesion: () => session.value?.user.id,
    })
  }
  await fetchRutas()
})

watch(rutasVisibles, (nuevasRutas) => {
  leafletMap?.renderRutas(nuevasRutas)
})

// Si se cierra la sesión mientras el formulario está abierto (p. ej. en
// otra pestaña), no tiene sentido dejarlo abierto: ya no se podría guardar.
watch(session, (nuevaSesion) => {
  if (!nuevaSesion && formAbierto.value) cerrarFormulario()
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

function esEscritorio(): boolean {
  return window.matchMedia(`(min-width: ${ANCHO_BREAKPOINT_ESCRITORIO_PX}px)`).matches
}

function onSeleccionarRutaDeLista(ruta: RutaConEstado): void {
  if (esEscritorio()) {
    leafletMap?.flyToRoute(ruta, panelRutasAbierto.value ? ANCHO_PANEL_RUTAS_PX : 0)
  } else {
    panelRutasAbierto.value = false
    leafletMap?.flyToRoute(ruta, 0)
  }
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

    <div class="top-actions">
      <button
        type="button"
        class="boton-secundario"
        @click="panelRutasAbierto = true"
      >
        Rutas
      </button>
      <button
        v-if="session"
        type="button"
        class="boton-secundario"
        @click="logout"
      >
        Salir
      </button>
      <button
        v-else
        type="button"
        class="boton-secundario"
        @click="loginAbierto = true"
      >
        Iniciar sesión
      </button>
    </div>

    <div
      ref="mapContainer"
      class="map-container"
    />

    <div
      v-if="session"
      class="map-actions"
    >
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

  <LoginModal
    v-if="loginAbierto"
    @cerrar="loginAbierto = false"
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

.top-actions {
  position: absolute;
  z-index: 1000;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
}

.boton-secundario {
  min-width: 44px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-weight: 600;
  padding: 0 var(--space-2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.map-actions {
  display: flex;
  gap: var(--space-2);
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
