<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ordenarRutas, type CriterioOrden, type DireccionOrden } from '@/lib/ordenarRutas'
import { guardarOrdenElegido, leerOrdenGuardado } from '@/lib/preferenciaOrdenRutas'
import { descargarExportacion } from '@/lib/exportarRutas'
import { useAuth } from '@/composables/useAuth'
import { useInstallPrompt } from '@/composables/useInstallPrompt'
import { useRoutes } from '@/composables/useRoutes'
import type { RutaConEstado } from '@/composables/useVisibleRoutes'

const { disponible: instalacionDisponible, instalar } = useInstallPrompt()
const { session } = useAuth()
// Las rutas "en bruto" (useRoutes), no las visibles fusionadas con la cola
// (useVisibleRoutes): la exportación no debe incluir rutas pendientes de
// sincronizar que todavía no son una fila real en el servidor.
const { rutas: rutasSinFusionar } = useRoutes()

function exportarDatos(): void {
  const propioUserId = session.value?.user.id
  if (!propioUserId) return
  const propias = rutasSinFusionar.value.filter((ruta) => ruta.user_id === propioUserId)
  descargarExportacion(propias)
}

const props = defineProps<{
  abierto: boolean
  rutas: RutaConEstado[]
}>()

const emit = defineEmits<{
  cerrar: []
  seleccionar: [ruta: RutaConEstado]
}>()

const ordenGuardado = leerOrdenGuardado()
const criterio = ref<CriterioOrden>(ordenGuardado.criterio)
const direccion = ref<DireccionOrden>(ordenGuardado.direccion)

watch([criterio, direccion], () => {
  guardarOrdenElegido({ criterio: criterio.value, direccion: direccion.value })
})

const rutasOrdenadas = computed(() => ordenarRutas(props.rutas, criterio.value, direccion.value))

function elegirCriterio(nuevo: CriterioOrden): void {
  if (criterio.value === nuevo) {
    direccion.value = direccion.value === 'asc' ? 'desc' : 'asc'
  } else {
    criterio.value = nuevo
  }
}

function flechaPara(valor: CriterioOrden): string {
  if (criterio.value !== valor) return ''
  return direccion.value === 'asc' ? '↑' : '↓'
}

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function onSeleccionar(ruta: RutaConEstado): void {
  emit('seleccionar', ruta)
}
</script>

<template>
  <div
    v-if="abierto"
    id="panel-rutas"
    class="panel-rutas"
    role="dialog"
    aria-label="Lista de rutas"
  >
    <header class="panel-header">
      <h2>Rutas ({{ rutas.length }})</h2>
      <button
        type="button"
        class="panel-cerrar"
        aria-label="Cerrar"
        @click="emit('cerrar')"
      >
        ✕
      </button>
    </header>

    <div
      class="panel-orden"
      role="group"
      aria-label="Ordenar rutas"
    >
      <button
        type="button"
        :aria-pressed="criterio === 'nombre'"
        @click="elegirCriterio('nombre')"
      >
        Nombre {{ flechaPara('nombre') }}
      </button>
      <button
        type="button"
        :aria-pressed="criterio === 'fecha'"
        @click="elegirCriterio('fecha')"
      >
        Fecha {{ flechaPara('fecha') }}
      </button>
      <button
        type="button"
        :aria-pressed="criterio === 'distancia'"
        @click="elegirCriterio('distancia')"
      >
        Km {{ flechaPara('distancia') }}
      </button>
    </div>

    <p
      v-if="rutasOrdenadas.length === 0"
      class="panel-vacio"
    >
      Todavía no hay rutas guardadas.
    </p>

    <ul
      v-else
      class="panel-lista"
    >
      <li
        v-for="ruta in rutasOrdenadas"
        :key="ruta.id"
      >
        <button
          type="button"
          class="fila-ruta"
          @click="onSeleccionar(ruta)"
        >
          <span class="fila-nombre">{{ ruta.nombre }}</span>
          <span class="fila-datos">
            {{ formatearFecha(ruta.fecha) }} · {{ ruta.distancia_km }} km
          </span>
          <span
            v-if="ruta.pendienteSync"
            class="fila-pendiente"
          >
            Pendiente de sincronizar
          </span>
        </button>
      </li>
    </ul>

    <div
      v-if="session"
      class="panel-exportar"
    >
      <button
        type="button"
        class="panel-exportar-boton"
        @click="exportarDatos"
      >
        Exportar datos
      </button>
      <p class="panel-exportar-aviso">
        Las fotos no se incluyen en la exportación.
      </p>
    </div>

    <button
      v-if="instalacionDisponible"
      type="button"
      class="panel-instalar"
      @click="instalar"
    >
      Instalar app
    </button>
  </div>
</template>

<style scoped>
.panel-rutas {
  position: fixed;
  z-index: 1800;
  left: 0;
  right: 0;
  bottom: 0;
  /* Bottom sheet: como mucho el 60% de la pantalla, pero nunca invade la
     barra superior aunque el teclado/orientación reduzcan el alto. 100vh
     de respaldo; 100dvh evita que la barra de direcciones de Chrome en
     Android tape o desplace el panel. */
  max-height: min(60vh, calc(100vh - var(--alto-barra)));
  max-height: min(60dvh, calc(100dvh - var(--alto-barra)));
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius) var(--radius) 0 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.2);
}

@media (min-width: 768px) {
  .panel-rutas {
    left: auto;
    top: var(--alto-barra);
    bottom: 0;
    width: 360px;
    max-height: none;
    border-radius: 0;
    box-shadow: -2px 0 12px rgba(0, 0, 0, 0.2);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
}

.panel-cerrar {
  min-width: 44px;
  background: transparent;
  font-size: 18px;
}

.panel-orden {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.panel-orden button {
  flex: 1;
  min-height: 44px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 14px;
}

.panel-orden button[aria-pressed='true'] {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.panel-vacio {
  padding: var(--space-3);
  text-align: center;
  color: var(--color-text-muted);
}

.panel-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.fila-ruta {
  width: 100%;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-2);
  background: var(--color-surface);
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  text-align: left;
}

.fila-nombre {
  font-weight: 600;
}

.fila-datos {
  font-size: 13px;
  color: var(--color-text-muted);
}

.fila-pendiente {
  font-size: 12px;
  font-weight: 600;
  color: #7a5b00;
}

.panel-exportar {
  flex-shrink: 0;
  margin: var(--space-2) var(--space-2) 0;
}

.panel-exportar-boton {
  width: 100%;
  min-height: 44px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

.panel-exportar-aviso {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.panel-instalar {
  flex-shrink: 0;
  margin: var(--space-2);
  min-height: 44px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
}
</style>
