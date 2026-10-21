<script setup lang="ts">
import { computed } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { usePanelOverlay } from '@/composables/usePanelOverlay'

defineProps<{
  session: Session | null
}>()

const emit = defineEmits<{
  'cerrar-sesion': []
  'anadir-ruta': []
  'reiniciar-mapa': []
}>()

const { panelActivo, abrirPanel, cerrarPanel } = usePanelOverlay()
const rutasAbierto = computed(() => panelActivo.value === 'rutas')

function onClickRutas(): void {
  if (rutasAbierto.value) {
    cerrarPanel('rutas')
  } else {
    abrirPanel('rutas')
  }
}
</script>

<template>
  <header class="app-header">
    <button
      type="button"
      class="app-header-marca"
      aria-label="Rutácora — volver a la vista inicial del mapa"
      @click="emit('reiniciar-mapa')"
    >
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
    </button>

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
        id="boton-rutas"
        type="button"
        class="boton-secundario"
        :class="{ 'boton-secundario--activo': rutasAbierto }"
        :aria-expanded="rutasAbierto"
        aria-controls="panel-rutas"
        @click="onClickRutas"
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
        @click="abrirPanel('login')"
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
  background: var(--color-barra);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.app-header-marca {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  min-height: 44px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius);
  padding: 0 var(--space-1);
  margin-left: calc(var(--space-1) * -1);
  color: inherit;
  text-align: left;
  transition: background-color 0.15s ease;
}

.app-header-marca:hover {
  background: rgba(255, 255, 255, 0.15);
}

.app-header-icono {
  width: 24px;
  height: 24px;
  color: #fff;
  flex-shrink: 0;
}

.app-header-marca h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
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
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.6);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.boton-secundario:hover {
  background: rgba(255, 255, 255, 0.15);
}

.boton-secundario--activo,
.boton-secundario--activo:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
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

  .boton-anadir-barra:hover {
    background: var(--color-primary-dark);
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
