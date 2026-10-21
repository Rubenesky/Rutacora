import L from 'leaflet'
import { describe, expect, it } from 'vitest'
import { crearIconoRuta, svgIconoRuta } from './iconosRuta'

describe('iconosRuta: una sola fábrica, SVG en línea, sin L.Icon.Default', () => {
  it('"sincronizada" es un pin rojo (#d32f2f)', () => {
    expect(svgIconoRuta('sincronizada')).toContain('#d32f2f')
  })

  it('"pendiente" es un pin naranja (#ef6c00) con un reloj dentro (distinguible sin depender solo del color)', () => {
    const svg = svgIconoRuta('pendiente')
    expect(svg).toContain('#ef6c00')
    // El reloj se dibuja como un círculo + dos líneas (manecillas); el pin
    // "sincronizada" no tiene ningún <circle>.
    expect(svg).toContain('<circle')
  })

  it('"seleccion" es un pin azul (#1565c0), con un símbolo distinto del de "pendiente"', () => {
    const svgSeleccion = svgIconoRuta('seleccion')
    const svgPendiente = svgIconoRuta('pendiente')
    expect(svgSeleccion).toContain('#1565c0')
    expect(svgSeleccion).not.toBe(svgPendiente)
    // Mismo número de círculos (1), pero más líneas (retícula de 4 trazos
    // frente a las 2 manecillas del reloj): el contenido interior difiere,
    // no solo el color.
    const lineasSeleccion = (svgSeleccion.match(/<line/g) ?? []).length
    const lineasPendiente = (svgPendiente.match(/<line/g) ?? []).length
    expect(lineasSeleccion).not.toBe(lineasPendiente)
  })

  it('"seleccion" nunca es igual que un icono de ruta ("sincronizada" o "pendiente")', () => {
    const svgSeleccion = svgIconoRuta('seleccion')
    expect(svgSeleccion).not.toBe(svgIconoRuta('sincronizada'))
    expect(svgSeleccion).not.toBe(svgIconoRuta('pendiente'))
    expect(svgSeleccion).not.toContain('#d32f2f')
    expect(svgSeleccion).not.toContain('#ef6c00')
  })

  it('los tres estados producen SVG distinto entre sí', () => {
    const svgs = new Set([
      svgIconoRuta('sincronizada'),
      svgIconoRuta('pendiente'),
      svgIconoRuta('seleccion'),
    ])
    expect(svgs.size).toBe(3)
  })

  it('crearIconoRuta() es un L.DivIcon (nunca L.Icon ni L.Icon.Default) con área táctil de al menos 44x44', () => {
    const icono = crearIconoRuta('sincronizada', 'Mi ruta')
    const opciones = icono.options
    const [ancho, alto] = opciones.iconSize as [number, number]
    expect(ancho).toBeGreaterThanOrEqual(44)
    expect(alto).toBeGreaterThanOrEqual(44)
    // L.DivIcon no tiene iconUrl/shadowUrl (a diferencia de L.Icon): nada
    // que Vite tenga que bundlear como imagen.
    expect(opciones).not.toHaveProperty('iconUrl')
    expect(opciones).not.toHaveProperty('shadowUrl')
  })

  it('el título/aria-label usa el nombre de la ruta cuando se indica', () => {
    const icono = crearIconoRuta('sincronizada', 'Pico del Ejemplo')
    expect(icono.options.html).toContain('Pico del Ejemplo')
    expect(icono.options.html).toContain('aria-label')
  })

  it('el HTML del icono escapa el nombre (sin inyección si el nombre trae HTML)', () => {
    const icono = crearIconoRuta('sincronizada', '<script>alert(1)</script>')
    expect(icono.options.html).not.toContain('<script>alert')
  })

  it('el anclaje queda en la punta inferior del pin (iconAnchor con Y cercano al alto total)', () => {
    const icono = crearIconoRuta('sincronizada')
    const [, altoTotal] = icono.options.iconSize as [number, number]
    const [, anclaY] = icono.options.iconAnchor as [number, number]
    expect(anclaY).toBeGreaterThan(altoTotal * 0.8)
  })

  it('popupAnchor queda por encima de la cabeza del pin (Y negativo)', () => {
    const icono = crearIconoRuta('sincronizada')
    const [, popupY] = icono.options.popupAnchor as [number, number]
    expect(popupY).toBeLessThan(0)
  })

  it('red de seguridad: un L.marker sin icono explícito usa el icono de la fábrica, nunca L.Icon.Default', () => {
    const marker = L.marker([40, -3.7])
    expect(marker.options.icon).toBe(L.Marker.prototype.options.icon)
    expect(marker.options.icon).toBeInstanceOf(L.DivIcon)
    const icono = marker.options.icon as L.DivIcon
    expect(icono.options.html).toContain(svgIconoRuta('sincronizada'))
  })
})
