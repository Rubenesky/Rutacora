<script setup lang="ts">
import type { Session } from '@supabase/supabase-js'

defineProps<{
  session: Session | null
}>()

const emit = defineEmits<{
  'abrir-rutas': []
  'abrir-login': []
  'cerrar-sesion': []
  'anadir-ruta': []
}>()
</script>

<template>
  <header class="app-header">
    <div class="app-header-marca">
      <svg
        class="app-header-icono"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4 19 L10 7 L13 13 L15 9 L20 19 Z"
          fill="currentColor"
        />
      </svg>
      <h1>Rutácora</h1>
    </div>

    <div class="app-header-acciones">
      <button
        v-if="session"
        type="button"
        class="boton-secundario boton-anadir-barra"
        @click="emit('anadir-ruta')"
      >
        <span class="texto-largo">+ Añadir ruta</span>
        <span class="texto-corto">+ Añadir</span>
      </button>

      <button
        type="button"
        class="boton-secundario"
        @click="emit('abrir-rutas')"
      >
        Rutas
      </button>

      <button
        v-if="session"
        type="button"
        class="boton-secundario"
        @click="emit('cerrar-sesion')"
      >
        Salir
      </button>
      <button
        v-else
        type="button"
        class="boton-secundario"
        @click="emit('abrir-login')"
      >
        <span class="texto-largo">Iniciar sesión</span>
        <span class="texto-corto">Entrar</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 1000;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  height: var(--alto-barra);
  padding: env(safe-area-inset-top, 0px) var(--space-2) 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header-marca {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  flex-shrink: 0;
}

.app-header-icono {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.app-header-marca h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.app-header-acciones {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.boton-secundario {
  min-height: 44px;
  min-width: 44px;
  padding: 0 var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.boton-anadir-barra {
  display: none;
}

@media (min-width: 768px) {
  .boton-anadir-barra {
    display: inline-flex;
    align-items: center;
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
}

.texto-corto {
  display: none;
}

@media (max-width: 420px) {
  .texto-largo {
    display: none;
  }

  .texto-corto {
    display: inline;
  }
}
</style>
