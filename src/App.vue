<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/AppHeader.vue'
import LoginModal from '@/components/LoginModal.vue'
import MapView from '@/components/MapView.vue'
import PendingSyncBadge from '@/components/PendingSyncBadge.vue'

const { session, logout } = useAuth()
const loginAbierto = ref(false)
const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :session="session"
      @abrir-rutas="mapViewRef?.abrirPanelRutas()"
      @abrir-login="loginAbierto = true"
      @cerrar-sesion="logout"
      @anadir-ruta="mapViewRef?.abrirFormularioNuevo()"
    />
    <PendingSyncBadge />
    <div class="map-wrapper">
      <MapView ref="mapViewRef" />
    </div>
  </div>

  <LoginModal
    v-if="loginAbierto"
    @cerrar="loginAbierto = false"
  />
</template>

<style scoped>
.app-shell {
  height: 100svh;
  display: flex;
  flex-direction: column;
}

.map-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}
</style>
