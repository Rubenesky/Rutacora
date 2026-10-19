import { describe, expect, it, vi } from 'vitest'

// Regresión: si getSession() rechazara por algo inesperado (supabase-js no
// debería, pero no hay garantía documentada de que sea imposible), isReady
// debe pasar a true igualmente. Si no, fetchRutas() (que espera a isReady
// antes de pedir las rutas, ver useRoutes.ts) se quedaría colgado para
// siempre y la app nunca arrancaría sin red.
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.reject(new Error('fallo inesperado de red'))),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useAuth: getSession() que rechaza no debe colgar isReady', () => {
  it('isReady pasa a true y session queda en null, sin lanzar una excepción no capturada', async () => {
    const { useAuth } = await import('./useAuth')
    const { session, isReady } = useAuth()

    await flushPromises()

    expect(isReady.value).toBe(true)
    expect(session.value).toBeNull()
  })
})
