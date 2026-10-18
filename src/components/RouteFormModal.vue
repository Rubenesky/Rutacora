<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DIFICULTADES } from '@/lib/dificultad'
import { hayErrores, validarRuta } from '@/lib/validacionRuta'
import type { GuardarRutaInput } from '@/composables/useOfflineQueue'
import type { Ruta } from '@/types/database.types'

const props = defineProps<{
  inicial: Ruta | null
  lat: number | null
  lon: number | null
}>()

const emit = defineEmits<{
  cerrar: []
  guardar: [payload: GuardarRutaInput]
  'update:lat': [number]
  'update:lon': [number]
}>()

const esEdicion = computed(() => props.inicial !== null)

const nombre = ref('')
const distanciaKm = ref('')
const desnivelM = ref('')
const duracionMin = ref('')
const tipo = ref<'' | 'circular' | 'lineal'>('')
const fecha = ref(new Date().toISOString().slice(0, 10))
const dificultad = ref('')
const notas = ref('')
const latTexto = ref('')
const lonTexto = ref('')
const errorUbicacion = ref('')
const obteniendoUbicacion = ref(false)

function cargarDesdeInicial(): void {
  const r = props.inicial
  nombre.value = r?.nombre ?? ''
  distanciaKm.value = r ? String(r.distancia_km) : ''
  desnivelM.value = r?.desnivel_m != null ? String(r.desnivel_m) : ''
  duracionMin.value = r?.duracion_min != null ? String(r.duracion_min) : ''
  tipo.value = r?.tipo ?? ''
  fecha.value = r?.fecha ?? new Date().toISOString().slice(0, 10)
  dificultad.value = r?.dificultad ?? ''
  notas.value = r?.notas ?? ''
}

cargarDesdeInicial()
watch(() => props.inicial, cargarDesdeInicial)

watch(
  () => props.lat,
  (valor) => {
    latTexto.value = valor !== null ? String(valor) : ''
  },
  { immediate: true },
)
watch(
  () => props.lon,
  (valor) => {
    lonTexto.value = valor !== null ? String(valor) : ''
  },
  { immediate: true },
)

function onLatInput(): void {
  const valor = Number.parseFloat(latTexto.value)
  if (!Number.isNaN(valor)) emit('update:lat', valor)
}

function onLonInput(): void {
  const valor = Number.parseFloat(lonTexto.value)
  if (!Number.isNaN(valor)) emit('update:lon', valor)
}

function usarMiUbicacion(): void {
  errorUbicacion.value = ''

  if (!navigator.geolocation) {
    errorUbicacion.value = 'Este dispositivo no permite obtener la ubicación.'
    return
  }

  obteniendoUbicacion.value = true
  navigator.geolocation.getCurrentPosition(
    (posicion) => {
      obteniendoUbicacion.value = false
      emit('update:lat', posicion.coords.latitude)
      emit('update:lon', posicion.coords.longitude)
    },
    (error) => {
      obteniendoUbicacion.value = false
      if (error.code === error.PERMISSION_DENIED) {
        errorUbicacion.value =
          'Permiso de ubicación denegado. Puedes tocar el mapa o escribir las coordenadas a mano.'
      } else {
        errorUbicacion.value =
          'No se pudo obtener tu ubicación. Puedes tocar el mapa o escribir las coordenadas a mano.'
      }
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  )
}

const errores = ref<ReturnType<typeof validarRuta>>({})

function onGuardar(): void {
  const datos = {
    nombre: nombre.value,
    lat: props.lat,
    lon: props.lon,
    distancia_km: distanciaKm.value === '' ? null : Number.parseFloat(distanciaKm.value),
    desnivel_m: desnivelM.value === '' ? null : Number.parseInt(desnivelM.value, 10),
    duracion_min: duracionMin.value === '' ? null : Number.parseInt(duracionMin.value, 10),
    fecha: fecha.value,
    dificultad: dificultad.value,
  }

  errores.value = validarRuta(datos)
  if (hayErrores(errores.value)) return

  emit('guardar', {
    id: props.inicial?.id,
    nombre: datos.nombre.trim(),
    lat: datos.lat as number,
    lon: datos.lon as number,
    distancia_km: datos.distancia_km as number,
    desnivel_m: datos.desnivel_m,
    duracion_min: datos.duracion_min,
    tipo: tipo.value === '' ? null : tipo.value,
    fecha: datos.fecha,
    dificultad: dificultad.value as GuardarRutaInput['dificultad'],
    notas: notas.value.trim() === '' ? null : notas.value.trim(),
  })
}
</script>

<template>
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
  >
    <div class="modal-sheet">
      <header class="modal-header">
        <h2>{{ esEdicion ? 'Editar ruta' : 'Añadir ruta' }}</h2>
        <button
          type="button"
          class="modal-cerrar"
          aria-label="Cerrar"
          @click="emit('cerrar')"
        >
          ✕
        </button>
      </header>

      <form
        class="modal-form"
        @submit.prevent="onGuardar"
      >
        <label for="campo-nombre">Nombre</label>
        <input
          id="campo-nombre"
          v-model="nombre"
          type="text"
          autocomplete="off"
        >
        <p
          v-if="errores.nombre"
          class="campo-error"
        >
          {{ errores.nombre }}
        </p>

        <fieldset class="campo-ubicacion">
          <legend>Ubicación</legend>
          <p class="ayuda">
            Toca el mapa o arrastra el marcador para fijar el punto.
          </p>

          <div class="fila-coordenadas">
            <div>
              <label for="campo-lat">Latitud</label>
              <input
                id="campo-lat"
                v-model="latTexto"
                type="number"
                inputmode="decimal"
                step="any"
                @change="onLatInput"
              >
            </div>
            <div>
              <label for="campo-lon">Longitud</label>
              <input
                id="campo-lon"
                v-model="lonTexto"
                type="number"
                inputmode="decimal"
                step="any"
                @change="onLonInput"
              >
            </div>
          </div>

          <button
            type="button"
            :disabled="obteniendoUbicacion"
            @click="usarMiUbicacion"
          >
            {{ obteniendoUbicacion ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
          </button>

          <p
            v-if="errorUbicacion"
            class="campo-error"
          >
            {{ errorUbicacion }}
          </p>
          <p
            v-if="errores.ubicacion"
            class="campo-error"
          >
            {{ errores.ubicacion }}
          </p>
        </fieldset>

        <label for="campo-distancia">Distancia (km)</label>
        <input
          id="campo-distancia"
          v-model="distanciaKm"
          type="number"
          inputmode="decimal"
          step="0.1"
          min="0"
        >
        <p
          v-if="errores.distancia_km"
          class="campo-error"
        >
          {{ errores.distancia_km }}
        </p>

        <div class="fila-coordenadas">
          <div>
            <label for="campo-desnivel">Desnivel (m)</label>
            <input
              id="campo-desnivel"
              v-model="desnivelM"
              type="number"
              inputmode="numeric"
              min="0"
            >
            <p
              v-if="errores.desnivel_m"
              class="campo-error"
            >
              {{ errores.desnivel_m }}
            </p>
          </div>
          <div>
            <label for="campo-duracion">Duración (min)</label>
            <input
              id="campo-duracion"
              v-model="duracionMin"
              type="number"
              inputmode="numeric"
              min="0"
            >
            <p
              v-if="errores.duracion_min"
              class="campo-error"
            >
              {{ errores.duracion_min }}
            </p>
          </div>
        </div>

        <fieldset class="campo-radio">
          <legend>Tipo</legend>
          <label><input
            v-model="tipo"
            type="radio"
            value=""
          > Sin especificar</label>
          <label><input
            v-model="tipo"
            type="radio"
            value="circular"
          > Circular</label>
          <label><input
            v-model="tipo"
            type="radio"
            value="lineal"
          > Lineal</label>
        </fieldset>

        <label for="campo-fecha">Fecha</label>
        <input
          id="campo-fecha"
          v-model="fecha"
          type="date"
        >
        <p
          v-if="errores.fecha"
          class="campo-error"
        >
          {{ errores.fecha }}
        </p>

        <fieldset class="campo-radio">
          <legend>Dificultad</legend>
          <label
            v-for="valor in DIFICULTADES"
            :key="valor"
          >
            <input
              v-model="dificultad"
              type="radio"
              :value="valor"
            >
            {{ valor }}
          </label>
        </fieldset>
        <p
          v-if="errores.dificultad"
          class="campo-error"
        >
          {{ errores.dificultad }}
        </p>

        <label for="campo-notas">Notas</label>
        <textarea
          id="campo-notas"
          v-model="notas"
          rows="3"
        />
      </form>

      <footer class="modal-footer">
        <button
          type="button"
          class="boton-secundario"
          @click="emit('cerrar')"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="boton-primario"
          @click="onGuardar"
        >
          Guardar
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.modal-sheet {
  background: var(--color-surface);
  border-radius: var(--radius) var(--radius) 0 0;
  max-height: 92svh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-cerrar {
  min-width: 44px;
  background: transparent;
  font-size: 18px;
}

.modal-form {
  padding: var(--space-2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.modal-form label {
  font-weight: 600;
  margin-top: var(--space-1);
}

.modal-form input,
.modal-form textarea {
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
}

.modal-form textarea {
  padding: var(--space-1) var(--space-2);
  min-height: 80px;
}

.fila-coordenadas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.campo-ubicacion,
.campo-radio {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-2);
  margin: 0;
}

.campo-radio {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.campo-radio label {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  margin: 0;
  font-weight: 400;
}

.ayuda {
  margin: 0 0 var(--space-1);
  font-size: 13px;
  color: var(--color-text-muted);
}

.campo-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}

.modal-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.modal-footer button {
  flex: 1;
}

.boton-primario {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.boton-secundario {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
</style>
