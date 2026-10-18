<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'
import LoginView from '@/components/LoginView.vue'
import MapView from '@/components/MapView.vue'

const { session, isReady, logout } = useAuth()
</script>

<template>
  <main
    v-if="!isReady"
    class="app-shell"
  >
    <p>Cargando…</p>
  </main>
  <LoginView v-else-if="!session" />
  <div
    v-else
    class="app-authenticated"
  >
    <button
      type="button"
      class="logout-button"
      @click="logout"
    >
      Salir
    </button>
    <MapView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  text-align: center;
}

.app-authenticated {
  position: relative;
  height: 100svh;
}

.logout-button {
  position: absolute;
  z-index: 1000;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-weight: 600;
  padding: 0 var(--space-2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
