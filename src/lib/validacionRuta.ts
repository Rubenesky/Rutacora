import { DIFICULTADES } from './dificultad'

export interface DatosFormularioRuta {
  nombre: string
  lat: number | null
  lon: number | null
  distancia_km: number | null
  desnivel_m: number | null
  duracion_min: number | null
  fecha: string
  dificultad: string
}

export interface ErroresRuta {
  nombre?: string
  ubicacion?: string
  distancia_km?: string
  fecha?: string
  dificultad?: string
  desnivel_m?: string
  duracion_min?: string
}

export function validarRuta(input: DatosFormularioRuta): ErroresRuta {
  const errores: ErroresRuta = {}

  if (!input.nombre.trim()) {
    errores.nombre = 'El nombre es obligatorio.'
  }

  if (input.lat === null || input.lon === null) {
    errores.ubicacion = 'Elige una ubicación: toca el mapa, usa tu ubicación o escribe las coordenadas.'
  } else if (Number.isNaN(input.lat) || input.lat < -90 || input.lat > 90) {
    errores.ubicacion = 'La latitud debe estar entre -90 y 90.'
  } else if (Number.isNaN(input.lon) || input.lon < -180 || input.lon > 180) {
    errores.ubicacion = 'La longitud debe estar entre -180 y 180.'
  }

  if (input.distancia_km === null || Number.isNaN(input.distancia_km) || input.distancia_km <= 0) {
    errores.distancia_km = 'La distancia debe ser un número mayor que 0.'
  }

  if (!input.fecha) {
    errores.fecha = 'La fecha es obligatoria.'
  }

  if (!(DIFICULTADES as readonly string[]).includes(input.dificultad)) {
    errores.dificultad = 'Elige una dificultad de la lista.'
  }

  if (input.desnivel_m !== null && (Number.isNaN(input.desnivel_m) || input.desnivel_m < 0)) {
    errores.desnivel_m = 'El desnivel no puede ser negativo.'
  }

  if (input.duracion_min !== null && (Number.isNaN(input.duracion_min) || input.duracion_min < 0)) {
    errores.duracion_min = 'La duración no puede ser negativa.'
  }

  return errores
}

export function hayErrores(errores: ErroresRuta): boolean {
  return Object.keys(errores).length > 0
}
