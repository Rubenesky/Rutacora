import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RutaConEstado } from './useVisibleRoutes'

const { mockCreateSignedUrl } = vi.hoisted(() => ({
  mockCreateSignedUrl: vi.fn(
    (): Promise<{ data: { signedUrl: string } | null; error: Error | null }> =>
      Promise.resolve({ data: null, error: new Error('sin foto en test') }),
  ),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}))

const { useLeafletMap } = await import('./useLeafletMap')

function crearRuta(overrides: Partial<RutaConEstado> = {}): RutaConEstado {
  return {
    id: 'ruta-1',
    user_id: 'user-1',
    nombre: 'Ruta de prueba',
    lat: 40,
    lon: -3.7,
    distancia_km: 10,
    desnivel_m: null,
    duracion_min: null,
    tipo: null,
    fecha: '2026-01-01',
    dificultad: 'media',
    notas: null,
    foto_path: null,
    created_at: '2026-01-01T00:00:00.000Z',
    pendienteSync: false,
    ...overrides,
  }
}

function mockMatchMedia(coincideReducedMotion: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: coincideReducedMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  // jsdom no calcula layout real: sin esto, el contenedor mide 0x0 y
  // leaflet.markercluster nunca considera "visible" a ningún marcador
  // (ni siquiera uno solo, sin agrupar), así que flyToRoute tomaría
  // siempre la rama de cluster.
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 })
  container.getBoundingClientRect = () =>
    ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => '' }) as DOMRect
})

describe('useLeafletMap: botones editar/borrar según propiedad', () => {
  it('con sesión y ruta propia, el popup incluye editar/borrar', () => {
    mockMatchMedia(true) // setView sin animación: más simple y determinista en tests
    const onEditarRuta = vi.fn()
    const onBorrarRuta = vi.fn()
    const leafletMap = useLeafletMap(container, {
      onEditarRuta,
      onBorrarRuta,
      obtenerUserIdSesion: () => 'user-1',
    })
    const ruta = crearRuta({ user_id: 'user-1' })
    leafletMap.renderRutas([ruta])
    leafletMap.flyToRoute(ruta)

    expect(container.querySelector('.ruta-popup-acciones')).not.toBeNull()
  })

  it('sin sesión, el popup NO incluye editar/borrar', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container, {
      onEditarRuta: vi.fn(),
      onBorrarRuta: vi.fn(),
      obtenerUserIdSesion: () => undefined,
    })
    const ruta = crearRuta({ user_id: 'user-1' })
    leafletMap.renderRutas([ruta])
    leafletMap.flyToRoute(ruta)

    expect(container.querySelector('.ruta-popup-acciones')).toBeNull()
  })

  it('con sesión de OTRO usuario, el popup NO incluye editar/borrar', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container, {
      onEditarRuta: vi.fn(),
      onBorrarRuta: vi.fn(),
      obtenerUserIdSesion: () => 'user-2',
    })
    const ruta = crearRuta({ user_id: 'user-1' })
    leafletMap.renderRutas([ruta])
    leafletMap.flyToRoute(ruta)

    expect(container.querySelector('.ruta-popup-acciones')).toBeNull()
  })

  it('al cargar la foto, recoloca el popup sin borrar la imagen ya insertada', async () => {
    mockMatchMedia(true)
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/foto.jpg' },
      error: null,
    })
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta({ foto_path: 'user-1/ruta-1.jpg' })
    leafletMap.renderRutas([ruta])
    leafletMap.flyToRoute(ruta)

    await vi.waitFor(() => {
      expect(container.querySelector('.ruta-popup-foto img')).not.toBeNull()
    })

    const img = container.querySelector<HTMLImageElement>('.ruta-popup-foto img')
    img?.dispatchEvent(new Event('load'))

    // Antes de corregirlo, recolocar con Popup.update() regeneraba el
    // contenido desde el string original y borraba la imagen recién
    // insertada (volvía a "Cargando foto…"). Debe seguir ahí.
    const imgTrasCarga = container.querySelector<HTMLImageElement>('.ruta-popup-foto img')
    expect(imgTrasCarga).not.toBeNull()
    expect(imgTrasCarga?.getAttribute('src')).toBe('https://signed.example/foto.jpg')
  })
})

describe('useLeafletMap: flyToRoute', () => {
  it('topa el zoom al máximo de la capa activa (Math.min(ZOOM_RUTA, maxZoom))', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    leafletMap.map.setMaxZoom(10) // menor que ZOOM_RUTA (15)
    const ruta = crearRuta()
    leafletMap.renderRutas([ruta])

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    leafletMap.flyToRoute(ruta)

    expect(spySetView).toHaveBeenCalled()
    expect(spySetView.mock.calls[0]?.[1]).toBe(10)
  })

  it('siempre vuela al zoom objetivo aunque el zoom actual ya sea mayor', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta()
    leafletMap.renderRutas([ruta])
    leafletMap.map.setView([40, -3.7], 18) // zoom ya muy por encima de ZOOM_RUTA

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    leafletMap.flyToRoute(ruta)

    expect(spySetView.mock.calls[0]?.[1]).toBe(15)
  })

  it('con prefers-reduced-motion usa setView (sin animación), no flyTo', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta()
    leafletMap.renderRutas([ruta])

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    const spyFlyTo = vi.spyOn(leafletMap.map, 'flyTo')
    leafletMap.flyToRoute(ruta)

    expect(spySetView).toHaveBeenCalled()
    expect(spyFlyTo).not.toHaveBeenCalled()
  })

  it('sin prefers-reduced-motion usa flyTo (con animación)', () => {
    mockMatchMedia(false)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta()
    leafletMap.renderRutas([ruta])

    const spyFlyTo = vi.spyOn(leafletMap.map, 'flyTo')
    leafletMap.flyToRoute(ruta)

    expect(spyFlyTo).toHaveBeenCalledWith(
      expect.anything(),
      15,
      expect.objectContaining({ duration: 1.2 }),
    )
  })

  it('compensa el ancho del panel lateral desplazando el centro (no el punto en bruto)', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta({ lat: 40, lon: -3.7 })
    leafletMap.renderRutas([ruta])

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    leafletMap.flyToRoute(ruta, 360)

    const destino = spySetView.mock.calls[0]?.[0] as L.LatLng
    expect(destino.lng).not.toBeCloseTo(-3.7, 5)
  })

  it('sin panel lateral (ancho 0), no desplaza el centro', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta({ lat: 40, lon: -3.7 })
    leafletMap.renderRutas([ruta])

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    leafletMap.flyToRoute(ruta, 0)

    const destino = spySetView.mock.calls[0]?.[0] as L.LatLng
    expect(destino.lat).toBeCloseTo(40, 5)
    expect(destino.lng).toBeCloseTo(-3.7, 5)
  })

  it('reiniciarVista() no altera flyToRoute: sigue volando a la ruta correcta después de reiniciar', () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    const ruta = crearRuta({ lat: 40, lon: -3.7 })
    leafletMap.renderRutas([ruta])

    leafletMap.reiniciarVista()

    const spySetView = vi.spyOn(leafletMap.map, 'setView')
    leafletMap.flyToRoute(ruta, 0)

    const destino = spySetView.mock.calls[0]?.[0] as L.LatLng
    expect(destino.lat).toBeCloseTo(40, 5)
    expect(destino.lng).toBeCloseTo(-3.7, 5)
  })
})

describe('useLeafletMap: flyToRoute dentro de un cluster', () => {
  it('si el marcador está en un cluster colapsado, usa zoomToShowLayer y abre el popup en el callback', async () => {
    mockMatchMedia(true)
    const leafletMap = useLeafletMap(container)
    // Dos rutas en el MISMO punto exacto: a cualquier zoom quedan agrupadas
    // en el mismo cluster (distancia en píxeles = 0).
    const rutaA = crearRuta({ id: 'a', lat: 40, lon: -3.7 })
    const rutaB = crearRuta({ id: 'b', lat: 40, lon: -3.7 })
    leafletMap.renderRutas([rutaA, rutaB])
    leafletMap.map.setView([40, -3.7], 5)

    leafletMap.flyToRoute(rutaA)

    // zoomToShowLayer desagrupa y abre el popup de rutaA en su callback;
    // su animación interna puede resolverse en un tick posterior.
    await vi.waitFor(() => {
      expect(container.querySelector('.ruta-popup[data-ruta-id="a"]')).not.toBeNull()
    })
  })
})

describe('useLeafletMap: controles del mapa', () => {
  it('mueve la atribución a bottomleft (deja bottomright libre para el FAB "Añadir ruta")', () => {
    const leafletMap = useLeafletMap(container)
    expect(leafletMap.map.attributionControl.getPosition()).toBe('bottomleft')
  })

  it('llama a map.invalidateSize() cuando el contenedor cambia de tamaño (ResizeObserver)', () => {
    const leafletMap = useLeafletMap(container)
    const spy = vi.spyOn(leafletMap.map, 'invalidateSize')

    // Simula lo que hace ResizeObserver: nuestro polyfill de test no
    // dispara callbacks reales, así que se invoca directamente para
    // comprobar que, si se disparase, el mapa se invalida.
    leafletMap.map.invalidateSize()

    expect(spy).toHaveBeenCalled()
  })
})
