<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useRoutes } from '@/composables/useRoutes'

const mapContainer = ref<HTMLElement | null>(null)
const { rutas, isLoading, errorMessage, fetchRutas } = useRoutes()

let leafletMap: ReturnType<typeof useLeafletMap> | null = null

onMounted(async () => {
  if (mapContainer.value) {
    leafletMap = useLeafletMap(mapContainer.value)
  }
  await fetchRutas()
})

watch(rutas, (nuevasRutas) => {
  leafletMap?.renderRutas(nuevasRutas)
})

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
  </div>
</template>

<style scoped>
.map-view {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
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
