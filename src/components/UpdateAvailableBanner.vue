<script setup lang="ts">
import { useServiceWorkerUpdate } from '@/composables/useServiceWorkerUpdate'

const { needRefresh, solicitarActualizacion } = useServiceWorkerUpdate()
</script>

<template>
  <div
    v-if="needRefresh"
    class="update-badge"
    role="status"
  >
    <span class="update-badge-texto">Hay una versión nueva</span>
    <button
      type="button"
      class="update-badge-boton"
      @click="solicitarActualizacion"
    >
      Actualizar
    </button>
  </div>
</template>

<style scoped>
/* Mismo "sistema de avisos bajo la barra" que PendingSyncBadge: una franja
   de una sola línea, sin solapar ningún control (vive en el flujo normal
   del documento, entre la barra y el mapa, no superpuesta). */
.update-badge {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.update-badge-texto {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-badge-boton {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 var(--space-2);
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}
</style>
