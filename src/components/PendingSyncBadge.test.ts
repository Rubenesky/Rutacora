import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Session } from '@supabase/supabase-js'
import type { ColaItem } from '@/lib/offlineDb'
import PendingSyncBadge from './PendingSyncBadge.vue'
import { useAuth } from '@/composables/useAuth'
import { useOfflineQueue } from '@/composables/useOfflineQueue'

const USER_ID = 'user-1'

function crearItem(overrides: Partial<ColaItem> = {}): ColaItem {
  return {
    id: 'item-1',
    tipo: 'guardar',
    propietarioUserId: USER_ID,
    ruta: {
      id: 'ruta-1',
      nombre: 'Ruta pendiente',
      lat: 40,
      lon: -3,
      distancia_km: 5,
      desnivel_m: null,
      duracion_min: null,
      tipo: null,
      fecha: '2026-01-01',
      dificultad: 'fácil',
      notas: null,
    } as ColaItem['ruta'],
    accionFoto: 'mantener',
    foto: null,
    fotoPathExistente: null,
    fotoPathABorrar: null,
    estado: 'pendiente',
    bloqueado: false,
    creadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ColaItem
}

describe('PendingSyncBadge: aviso colapsado por defecto', () => {
  it('colapsado solo muestra la cabecera de una línea; la lista no es visible (no aporta alto)', () => {
    const { session } = useAuth()
    const { pendientes } = useOfflineQueue()
    session.value = { user: { id: USER_ID } } as unknown as Session
    pendientes.value = [crearItem({ id: 'a' }), crearItem({ id: 'b' })]

    const wrapper = mount(PendingSyncBadge)

    const cabecera = wrapper.find('.sync-badge-cabecera')
    expect(cabecera.exists()).toBe(true)
    expect(cabecera.attributes('aria-expanded')).toBe('false')
    expect(cabecera.text()).toContain('2 rutas pendientes de sincronizar')

    const lista = wrapper.find('#sync-badge-lista')
    expect(lista.exists()).toBe(true)
    expect((lista.element as HTMLElement).style.display).toBe('none')

    wrapper.unmount()
    pendientes.value = []
  })

  it('al tocar la cabecera se expande (aria-expanded y la lista pasan a visibles)', async () => {
    const { session } = useAuth()
    const { pendientes } = useOfflineQueue()
    session.value = { user: { id: USER_ID } } as unknown as Session
    pendientes.value = [crearItem({ id: 'a' })]

    const wrapper = mount(PendingSyncBadge)
    const cabecera = wrapper.find('.sync-badge-cabecera')

    await cabecera.trigger('click')

    expect(cabecera.attributes('aria-expanded')).toBe('true')
    expect((wrapper.find('#sync-badge-lista').element as HTMLElement).style.display).not.toBe('none')

    await cabecera.trigger('click')
    expect(cabecera.attributes('aria-expanded')).toBe('false')
    expect((wrapper.find('#sync-badge-lista').element as HTMLElement).style.display).toBe('none')

    wrapper.unmount()
    pendientes.value = []
  })
})
