<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'
import LoginView from '@/components/LoginView.vue'
import { APP_NAME } from '@/config'

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
  <main
    v-else
    class="app-shell"
  >
    <h1>{{ APP_NAME }}</h1>
    <p>Sesión iniciada. El mapa llega en el siguiente bloque.</p>
    <button
      type="button"
      @click="logout"
    >
      Cerrar sesión
    </button>
  </main>
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

.app-shell button {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  padding: 0 var(--space-3);
}
</style>
