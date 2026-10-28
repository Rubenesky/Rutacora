<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { DIFICULTADES } from '@/lib/dificultad'
import { obtenerUrlFoto } from '@/lib/obtenerUrlFoto'
import { ErrorFoto, procesarFoto } from '@/lib/procesarFoto'
import { hayErrores, validarRuta, type ErroresRuta } from '@/lib/validacionRuta'
import { usePanelOverlay } from '@/composables/usePanelOverlay'
import { useFocusTrap } from '@/composables/useFocusTrap'
import type { AccionFoto, GuardarRutaInput } from '@/composables/useOfflineQueue'
import type { Ruta } from '@/types/database.types'

const props = defineProps<{
  inicial: Ruta | null
  lat: number | null
  lon: number | null
  ubicacionYaElegida: boolean
}>()

const emit = defineEmits<{
  cerrar: []
  guardar: [payload: GuardarRutaInput, accionFoto: AccionFoto]
  'update:lat': [number]
  'update:lon': [number]
  'ubicacion-elegida-por-usuario': []
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

// --- Foto ---
const fotoPathExistente = computed(() => props.inicial?.foto_path ?? null)
const fotoExistentePreviewUrl = ref<string | null>(null)
const fotoNuevaBlob = ref<Blob | null>(null)
const fotoNuevaPreviewUrl = ref<string | null>(null)
const fotoQuitada = ref(false)
const procesandoFoto = ref(false)
const errorFoto = ref('')

function liberarPreviewNueva(): void {
  if (fotoNuevaPreviewUrl.value) URL.revokeObjectURL(fotoNuevaPreviewUrl.value)
  fotoNuevaPreviewUrl.value = null
}

async function cargarPreviewExistente(): Promise<void> {
  fotoExistentePreviewUrl.value = null
  if (!fotoPathExistente.value) return
  fotoExistentePreviewUrl.value = await obtenerUrlFoto(fotoPathExistente.value)
}

// Snapshot de los campos justo tras cargarlos, para poder detectar más
// tarde si el usuario ha cambiado algo (y así pedir confirmación antes de
// cerrar sin guardar, tanto desde los botones como desde Escape/atrás).
function capturarSnapshot(): string {
  return JSON.stringify({
    nombre: nombre.value,
    distanciaKm: distanciaKm.value,
    desnivelM: desnivelM.value,
    duracionMin: duracionMin.value,
    tipo: tipo.value,
    fecha: fecha.value,
    dificultad: dificultad.value,
    notas: notas.value,
    lat: props.lat,
    lon: props.lon,
    fotoQuitada: fotoQuitada.value,
    tieneFotoNueva: fotoNuevaBlob.value !== null,
  })
}

const snapshotInicial = ref('')

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

  liberarPreviewNueva()
  fotoNuevaBlob.value = null
  fotoQuitada.value = false
  errorFoto.value = ''
  void cargarPreviewExistente()
  snapshotInicial.value = capturarSnapshot()
}

cargarDesdeInicial()
watch(() => props.inicial, cargarDesdeInicial)

const sucio = computed(() => capturarSnapshot() !== snapshotInicial.value)

function confirmarCierre(): boolean {
  if (!sucio.value) return true
  return window.confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir?')
}

function solicitarCierre(): void {
  if (confirmarCierre()) emit('cerrar')
}

const { registrarConfirmacionCierre } = usePanelOverlay()
onMounted(() => registrarConfirmacionCierre('formulario', confirmarCierre))
onUnmounted(() => registrarConfirmacionCierre('formulario', null))

onUnmounted(liberarPreviewNueva)

// Atrapa el foco dentro del diálogo (role="dialog" + aria-modal="true"). El
// padre (MapView.vue) monta este componente con v-if="formAbierto", así que
// mientras exista está abierto: "activo" es un ref(true) fijo y useFocusTrap
// se encarga de entrar al montar y devolver el foco al desmontar.
const dialogoRef = ref<HTMLElement | null>(null)
useFocusTrap(dialogoRef, ref(true))

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
  if (!Number.isNaN(valor)) {
    emit('update:lat', valor)
    emit('ubicacion-elegida-por-usuario')
  }
}

function onLonInput(): void {
  const valor = Number.parseFloat(lonTexto.value)
  if (!Number.isNaN(valor)) {
    emit('update:lon', valor)
    emit('ubicacion-elegida-por-usuario')
  }
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
      emit('ubicacion-elegida-por-usuario')
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

async function onArchivoSeleccionado(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const archivo = input.files?.[0]
  if (!archivo) return

  errorFoto.value = ''
  procesandoFoto.value = true

  try {
    const resultado = await procesarFoto(archivo)
    liberarPreviewNueva()
    fotoNuevaBlob.value = resultado.blob
    fotoNuevaPreviewUrl.value = URL.createObjectURL(resultado.blob)
    fotoQuitada.value = false

    // Autorrelleno de ubicación con el GPS del EXIF SOLO si el usuario no ha
    // fijado una ubicación todavía (ni tocando el mapa, ni a mano, ni con
    // "Usar mi ubicación", ni porque ya es una ruta existente).
    if (resultado.ubicacionExif && !props.ubicacionYaElegida) {
      emit('update:lat', resultado.ubicacionExif.lat)
      emit('update:lon', resultado.ubicacionExif.lon)
    }
  } catch (err) {
    errorFoto.value = err instanceof ErrorFoto ? err.message : 'No se pudo procesar la foto.'
  } finally {
    procesandoFoto.value = false
    input.value = ''
  }
}

function quitarFoto(): void {
  liberarPreviewNueva()
  fotoNuevaBlob.value = null
  fotoQuitada.value = true
  errorFoto.value = ''
}

const errores = ref<ReturnType<typeof validarRuta>>({})

function calcularAccionFoto(): AccionFoto {
  if (fotoNuevaBlob.value) return { tipo: 'reemplazar', blob: fotoNuevaBlob.value }
  if (fotoQuitada.value) return { tipo: 'quitar' }
  return { tipo: 'mantener' }
}

// Latitud/longitud comparten dos posibles mensajes: el de geolocalización
// ("Usar mi ubicación" falló) y el de validación al guardar.
const describedbyUbicacion = computed(() => {
  const ids = [
    errorUbicacion.value ? 'error-ubicacion-gps' : null,
    errores.value.ubicacion ? 'error-ubicacion' : null,
  ].filter((id): id is string => id !== null)
  return ids.length > 0 ? ids.join(' ') : undefined
})

// Orden visual (de arriba a abajo) de los campos validados, con el id del
// elemento que debe recibir el foco si ese campo tiene error. Para grupos
// (ubicación, dificultad) se enfoca el primer control del grupo.
const ORDEN_CAMPOS_CON_ERROR: ReadonlyArray<[keyof ErroresRuta, string]> = [
  ['nombre', 'campo-nombre'],
  ['ubicacion', 'campo-lat'],
  ['distancia_km', 'campo-distancia'],
  ['desnivel_m', 'campo-desnivel'],
  ['duracion_min', 'campo-duracion'],
  ['fecha', 'campo-fecha'],
  ['dificultad', 'campo-dificultad-0'],
]

// Al pulsar "Guardar" con errores, lleva el foco al primer campo inválido
// (WCAG 3.3.1): antes no pasaba nada visible para un usuario de teclado o
// lector de pantalla. Se espera a nextTick para que el mensaje de error y el
// aria-describedby ya estén en el DOM y el lector lea el error al enfocar.
function enfocarPrimerCampoConError(): void {
  const primero = ORDEN_CAMPOS_CON_ERROR.find(([clave]) => errores.value[clave])
  if (!primero) return
  void nextTick(() => {
    dialogoRef.value?.querySelector<HTMLElement>(`#${primero[1]}`)?.focus()
  })
}

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
  if (hayErrores(errores.value)) {
    enfocarPrimerCampoConError()
    return
  }

  emit(
    'guardar',
    {
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
    },
    calcularAccionFoto(),
  )
}
</script>

<template>
  <div
    ref="dialogoRef"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="titulo-formulario-ruta"
  >
    <div class="modal-sheet">
      <header class="modal-header">
        <h2 id="titulo-formulario-ruta">
          {{ esEdicion ? 'Editar ruta' : 'Añadir ruta' }}
        </h2>
        <button
          type="button"
          class="modal-cerrar"
          aria-label="Cerrar"
          @click="solicitarCierre"
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
          :aria-invalid="!!errores.nombre"
          :aria-describedby="errores.nombre ? 'error-nombre' : undefined"
        >
        <p
          v-if="errores.nombre"
          id="error-nombre"
          role="alert"
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
                :aria-invalid="!!errores.ubicacion"
                :aria-describedby="describedbyUbicacion"
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
                :aria-invalid="!!errores.ubicacion"
                :aria-describedby="describedbyUbicacion"
                @change="onLonInput"
              >
            </div>
          </div>

          <button
            type="button"
            :disabled="obteniendoUbicacion"
            :aria-describedby="errorUbicacion ? 'error-ubicacion-gps' : undefined"
            @click="usarMiUbicacion"
          >
            {{ obteniendoUbicacion ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}
          </button>

          <p
            v-if="errorUbicacion"
            id="error-ubicacion-gps"
            role="alert"
            class="campo-error"
          >
            {{ errorUbicacion }}
          </p>
          <p
            v-if="errores.ubicacion"
            id="error-ubicacion"
            role="alert"
            class="campo-error"
          >
            {{ errores.ubicacion }}
          </p>
        </fieldset>

        <fieldset class="campo-foto">
          <legend>Foto de portada (opcional)</legend>

          <div
            v-if="fotoNuevaPreviewUrl"
            class="foto-preview"
          >
            <img
              :src="fotoNuevaPreviewUrl"
              alt="Foto nueva seleccionada"
            >
          </div>
          <div
            v-else-if="fotoExistentePreviewUrl && !fotoQuitada"
            class="foto-preview"
          >
            <img
              :src="fotoExistentePreviewUrl"
              alt="Foto actual de la ruta"
            >
          </div>
          <p
            v-else-if="fotoQuitada"
            class="ayuda"
          >
            Se quitará la foto al guardar.
          </p>

          <label for="campo-foto">Foto de la ruta</label>
          <input
            id="campo-foto"
            type="file"
            accept="image/*"
            :disabled="procesandoFoto"
            :aria-invalid="!!errorFoto"
            :aria-describedby="errorFoto ? 'error-foto' : undefined"
            @change="onArchivoSeleccionado"
          >

          <button
            v-if="fotoNuevaPreviewUrl || (fotoExistentePreviewUrl && !fotoQuitada)"
            type="button"
            class="boton-quitar-foto"
            @click="quitarFoto"
          >
            Quitar foto
          </button>

          <!-- La región de estado existe siempre (solo cambia su contenido):
               los lectores de pantalla solo anuncian de forma fiable los
               cambios dentro de una región viva ya presente en el DOM. -->
          <div
            role="status"
            class="estado-foto"
          >
            <p
              v-if="procesandoFoto"
              class="ayuda"
            >
              Procesando foto…
            </p>
          </div>
          <p
            v-if="errorFoto"
            id="error-foto"
            role="alert"
            class="campo-error"
          >
            {{ errorFoto }}
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
          :aria-invalid="!!errores.distancia_km"
          :aria-describedby="errores.distancia_km ? 'error-distancia' : undefined"
        >
        <p
          v-if="errores.distancia_km"
          id="error-distancia"
          role="alert"
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
              :aria-invalid="!!errores.desnivel_m"
              :aria-describedby="errores.desnivel_m ? 'error-desnivel' : undefined"
            >
            <p
              v-if="errores.desnivel_m"
              id="error-desnivel"
              role="alert"
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
              :aria-invalid="!!errores.duracion_min"
              :aria-describedby="errores.duracion_min ? 'error-duracion' : undefined"
            >
            <p
              v-if="errores.duracion_min"
              id="error-duracion"
              role="alert"
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
          :aria-invalid="!!errores.fecha"
          :aria-describedby="errores.fecha ? 'error-fecha' : undefined"
        >
        <p
          v-if="errores.fecha"
          id="error-fecha"
          role="alert"
          class="campo-error"
        >
          {{ errores.fecha }}
        </p>

        <!-- role="radiogroup" porque aria-invalid no está soportado en un
             group genérico (el rol implícito de <fieldset>) ni en cada radio. -->
        <fieldset
          class="campo-radio"
          role="radiogroup"
          :aria-invalid="!!errores.dificultad"
          :aria-describedby="errores.dificultad ? 'error-dificultad' : undefined"
        >
          <legend>Dificultad</legend>
          <label
            v-for="(valor, indice) in DIFICULTADES"
            :key="valor"
          >
            <input
              :id="`campo-dificultad-${indice}`"
              v-model="dificultad"
              type="radio"
              :value="valor"
            >
            {{ valor }}
          </label>
        </fieldset>
        <p
          v-if="errores.dificultad"
          id="error-dificultad"
          role="alert"
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
          @click="solicitarCierre"
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
  max-height: 92vh;
  max-height: 92dvh;
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
.campo-foto,
.campo-radio {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-2);
  margin: 0;
}

.campo-foto {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.campo-foto input[type='file'] {
  min-height: var(--tap-min);
}

/* La región role="status" está siempre montada; vacía, anula el hueco del
   gap del flex para no añadir espacio visual. */
.estado-foto:empty {
  margin-top: calc(-1 * var(--space-1));
}

.foto-preview img {
  max-width: 100%;
  max-height: 200px;
  border-radius: var(--radius);
  display: block;
}

.boton-quitar-foto {
  background: var(--color-surface);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  align-self: flex-start;
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
