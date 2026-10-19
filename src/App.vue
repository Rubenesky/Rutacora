<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { usePanelOverlay } from '@/composables/usePanelOverlay'
import AppHeader from '@/components/AppHeader.vue'
import LoginModal from '@/components/LoginModal.vue'
import MapView from '@/components/MapView.vue'
import PendingSyncBadge from '@/components/PendingSyncBadge.vue'

const { session, logout } = useAuth()
const { panelActivo, cerrarPanel } = usePanelOverlay()
const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :session="session"
      @cerrar-sesion="logout"
      @anadir-ruta="mapViewRef?.abrirFormularioNuevo()"
    />
    <PendingSyncBadge />
    <div class="map-wrapper">
      <MapView ref="mapViewRef" />
    </div>
  </div>

  <LoginModal
    v-if="panelActivo === 'login'"
    @cerrar="cerrarPanel('login')"
  />
</template>

<style scoped>
.app-shell {
  /* 100vh como respaldo (navegadores sin soporte de dvh); 100dvh evita que
     la barra de direcciones de Chrome en Android tape o desplace la app al
     mostrarse/ocultarse. */
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.map-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}
</style>
