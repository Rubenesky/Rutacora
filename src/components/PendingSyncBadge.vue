<script setup lang="ts">
import { useOfflineQueue } from '@/composables/useOfflineQueue'

const { pendientes, retry } = useOfflineQueue()

function etiquetaEstado(estado: string): string {
  if (estado === 'pendiente_login') return 'Pendiente de iniciar sesión'
  if (estado === 'error') return 'Error al sincronizar, pulsa para reintentar'
  return 'Pendiente de sincronizar'
}

function etiquetaOperacion(item: { tipo: string; ruta: { nombre: string } | null }): string {
  if (item.tipo === 'borrar') return 'Borrar ruta'
  return item.ruta?.nombre ?? 'Ruta'
}
</script>

<template>
  <div
    v-if="pendientes.length > 0"
    class="sync-badge"
    role="status"
  >
    <p class="sync-badge-title">
      {{ pendientes.length }} ruta{{ pendientes.length === 1 ? '' : 's' }} pendiente{{
        pendientes.length === 1 ? '' : 's'
      }}
      de sincronizar
    </p>
    <ul>
      <li
        v-for="item in pendientes"
        :key="item.id"
      >
        <span>{{ etiquetaOperacion(item) }} — {{ etiquetaEstado(item.estado) }}</span>
        <button
          type="button"
          @click="retry(item.id)"
        >
          Reintentar
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sync-badge {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-1) var(--space-2);
  font-size: 14px;
}

.sync-badge-title {
  margin: 0 0 var(--space-1);
  font-weight: 600;
}

.sync-badge ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sync-badge li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.sync-badge button {
  min-height: 44px;
  min-width: 44px;
  flex-shrink: 0;
  padding: 0 var(--space-2);
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
}
</style>
