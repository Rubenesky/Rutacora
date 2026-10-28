import { onMounted, onUnmounted, watch, type Ref } from 'vue'

const SELECTOR_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Atrapa el foco dentro de containerRef mientras "activo" sea true: Tab y
 * Shift+Tab nunca salen del contenedor, el foco entra al primer elemento
 * focalizable al activarse, y vuelve al elemento que lo tenía antes al
 * desactivarse. Antes LoginModal.vue, RouteFormModal.vue y
 * RouteListPanel.vue tenían role="dialog"/aria-modal="true" pero nada de
 * esto: con Tab se escapaba al mapa de fondo (auditoría de accesibilidad).
 *
 * "activo" es un ref observado, no se usa onMounted/onUnmounted del propio
 * diálogo: LoginModal.vue y RouteFormModal.vue los monta/desmonta su padre
 * con v-if (onMounted sí dispara ahí), pero RouteListPanel.vue permanece
 * montado y alterna un v-if="abierto" interno (onMounted del componente
 * NO vuelve a dispararse en cada toggle) — un único contrato que valga
 * para los tres evita tener dos formas distintas de activar el atrapado.
 * flush: 'post' espera a que ese v-if ya haya actualizado el DOM antes de
 * buscar elementos focalizables.
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null>, activo: Ref<boolean>): void {
  let elementoPrevio: HTMLElement | null = null

  function focusables(): HTMLElement[] {
    const el = containerRef.value
    if (!el) return []
    return Array.from(el.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE))
  }

  function onKeydown(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return
    const elementos = focusables()
    if (elementos.length === 0) return
    const primero = elementos[0]
    const ultimo = elementos[elementos.length - 1]
    const dentro = containerRef.value?.contains(document.activeElement) ?? false

    if (evento.shiftKey) {
      if (!dentro || document.activeElement === primero) {
        evento.preventDefault()
        ultimo?.focus()
      }
    } else {
      if (!dentro || document.activeElement === ultimo) {
        evento.preventDefault()
        primero?.focus()
      }
    }
  }

  function activar(): void {
    elementoPrevio = document.activeElement as HTMLElement | null
    containerRef.value?.addEventListener('keydown', onKeydown)
    focusables()[0]?.focus()
  }

  function desactivar(): void {
    containerRef.value?.removeEventListener('keydown', onKeydown)
    elementoPrevio?.focus()
    elementoPrevio = null
  }

  // No "immediate: true": en el primer render, setup() corre ANTES de que
  // el DOM exista, así que un disparo inmediato encontraría containerRef
  // todavía a null (flush: 'post' solo pospone los disparos POR CAMBIO
  // reactivo, no el inicial de "immediate"). onMounted cubre el caso
  // "ya activo al montar" (LoginModal.vue/RouteFormModal.vue, montados
  // por el padre con v-if); este watch cubre los cambios posteriores
  // (RouteListPanel.vue, que permanece montado y alterna un v-if interno).
  onMounted(() => {
    if (activo.value) activar()
  })

  watch(
    activo,
    (esActivo) => {
      if (esActivo) activar()
      else desactivar()
    },
    { flush: 'post' },
  )

  onUnmounted(() => {
    if (activo.value) desactivar()
  })
}
