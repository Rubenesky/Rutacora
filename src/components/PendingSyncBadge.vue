<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useOfflineQueue } from '@/composables/useOfflineQueue'

const { pendientes, retry } = useOfflineQueue()
const { session } = useAuth()

// Solo se muestran con detalle los pendientes de la cuenta con sesión
// activa. Sin sesión no se listan nombres de ruta (podrían ser de otra
// cuenta en un dispositivo compartido): solo un aviso genérico si hay
// algo en la cola, sin detalle ni reintento (eso requiere sesión).
const pendientesPropios = computed(() => {
  const sesionUserId = session.value?.user.id
  if (!sesionUserId) return []
  return pendientes.value.filter((item) => item.propietarioUserId === sesionUserId)
})

const hayPendientesDeOtraSesion = computed(
  () => !session.value && pendientes.value.length > 0,
)

function etiquetaEstado(estado: string): string {
  if (estado === 'pendiente_login') return 'Pendiente de iniciar sesión'
  if (estado === 'pendiente_login_otra_cuenta') return 'Pendiente de iniciar sesión (otra cuenta)'
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
    v-if="pendientesPropios.length > 0"
    class="sync-badge"
    role="status"
  >
    <p class="sync-badge-title">
      {{ pendientesPropios.length }} ruta{{ pendientesPropios.length === 1 ? '' : 's' }} pendiente{{
        pendientesPropios.length === 1 ? '' : 's'
      }}
      de sincronizar
    </p>
    <ul>
      <li
        v-for="item in pendientesPropios"
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
  <div
    v-else-if="hayPendientesDeOtraSesion"
    class="sync-badge"
    role="status"
  >
    <p class="sync-badge-title">
      Hay cambios pendientes de sincronizar. Inicia sesión para continuar.
    </p>
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
