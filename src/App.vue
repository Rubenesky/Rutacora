<script setup lang="ts">
import MapView from '@/components/MapView.vue'
import PendingSyncBadge from '@/components/PendingSyncBadge.vue'
</script>

<template>
  <div class="app-shell">
    <PendingSyncBadge />
    <div class="map-wrapper">
      <MapView />
    </div>
  </div>
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
