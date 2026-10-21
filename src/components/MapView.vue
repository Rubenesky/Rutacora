<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { usePanelOverlay } from '@/composables/usePanelOverlay'
import { useVisibleRoutes, type RutaConEstado } from '@/composables/useVisibleRoutes'
import { useOfflineQueue, type AccionFoto, type GuardarRutaInput } from '@/composables/useOfflineQueue'
import { ANCHO_BREAKPOINT_ESCRITORIO_PX, ANCHO_PANEL_RUTAS_PX } from '@/lib/constantes'
import RouteFormModal from './RouteFormModal.vue'
import RouteListPanel from './RouteListPanel.vue'
import type { Ruta } from '@/types/database.types'

const mapContainer = ref<HTMLElement | null>(null)
const { rutasVisibles, isLoading, errorMessage, fetchRutas } = useVisibleRoutes()
const { saveRoute, deleteRoute } = useOfflineQueue()
const { session } = useAuth()
const { panelActivo, abrirPanel, cerrarPanel } = usePanelOverlay()

let leafletMap: ReturnType<typeof useLeafletMap> | null = null

const formAbierto = computed(() => panelActivo.value === 'formulario')
const formInicial = ref<Ruta | null>(null)
const seleccionLat = ref<number | null>(null)
const seleccionLon = ref<number | null>(null)
// true si la ubicación ya viene de una edición existente, o si el usuario la
// ha fijado a mano/mapa/geolocalización durante esta sesión del formulario.
// Mientras sea false, una foto con GPS en el EXIF puede autorrellenarla.
const ubicacionElegida = ref(false)

const panelRutasAbierto = computed(() => panelActivo.value === 'rutas')

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
  if (!abrirPanel('formulario')) return // cancelado: otro panel tenía cambios sin guardar

  formInicial.value = ruta
  ubicacionElegida.value = ruta !== null
  const centro = leafletMap?.map.getCenter()
  seleccionLat.value = ruta?.lat ?? centro?.lat ?? null
  seleccionLon.value = ruta?.lon ?? centro?.lng ?? null

  if (seleccionLat.value !== null && seleccionLon.value !== null) {
    leafletMap?.iniciarSeleccionUbicacion(seleccionLat.value, seleccionLon.value, (lat, lon) => {
      seleccionLat.value = lat
      seleccionLon.value = lon
      ubicacionElegida.value = true
    })
  }
}

function cerrarFormulario(): void {
  cerrarPanel('formulario')
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
    cerrarPanel('rutas')
    leafletMap?.flyToRoute(ruta, 0)
  }
}

onUnmounted(() => {
  leafletMap?.destroy()
})

defineExpose({
  abrirPanelRutas: () => {
    abrirPanel('rutas')
  },
  abrirFormularioNuevo: () => abrirFormulario(null),
  reiniciarVista: () => leafletMap?.reiniciarVista(),
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

    <!-- Botón flotante "Añadir ruta": solo en móvil (<768px, vía CSS) y con
         sesión; se oculta mientras el panel de rutas está abierto para no
         quedar tapado por (ni tapar) el bottom sheet. En escritorio, el
         botón equivalente vive en la barra superior (AppHeader). -->
    <button
      v-if="session && !panelRutasAbierto"
      type="button"
      class="fab-anadir"
      aria-label="Añadir ruta"
      title="Añadir ruta"
      @click="abrirFormulario(null)"
    >
      <span aria-hidden="true">+</span>
      <span
        aria-hidden="true"
        class="fab-anadir-texto"
      >Añadir</span>
    </button>
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
    @cerrar="cerrarPanel('rutas')"
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

.fab-anadir {
  position: absolute;
  z-index: 1000;
  right: var(--space-2);
  /* 64px (no 24px): el plan gratuito de Netlify añade su insignia
     "Powered by Netlify" fija en la esquina inferior derecha, justo donde
     quedaba este botón en móvil, y la tapaba. */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 64px);
  width: 56px;
  height: 56px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  /* Anillo blanco de 3px (vía box-shadow, no border, para no afectar el
     tamaño) + sombra: destaca sobre zonas verdes del mapa (bosques, parques
     en las capas base). */
  box-shadow:
    0 0 0 3px #fff,
    0 2px 8px rgba(0, 0, 0, 0.3);
}

.fab-anadir-texto {
  display: none;
  font-size: 15px;
  font-weight: 600;
}

@media (min-width: 360px) {
  .fab-anadir {
    width: auto;
    padding: 0 22px 0 20px;
    border-radius: 28px;
  }

  .fab-anadir-texto {
    display: inline;
  }
}

@media (min-width: 768px) {
  .fab-anadir {
    display: none;
  }
}
</style>
