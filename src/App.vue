<script setup lang="ts">
import { APP_NAME } from '@/config'
</script>

<template>
  <main class="app-shell">
    <h1>{{ APP_NAME }}</h1>
    <p>Base del proyecto lista. El mapa, el login y el resto de bloques llegan a continuación.</p>
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
</style>
