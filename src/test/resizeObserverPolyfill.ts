// SOLO para tests: jsdom no implementa ResizeObserver. Este stub no
// necesita disparar callbacks de verdad (los tests de invalidateSize
// comprueban la llamada directamente), solo evitar que observe()/
// disconnect() lancen "ResizeObserver is not defined".
class ResizeObserverPolyfill {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}
