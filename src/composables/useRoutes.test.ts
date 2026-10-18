import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { COLUMNAS_PUBLICAS, COLUMNAS_SESION } from '@/lib/constantes'

const { mockGetSession, mockOnAuthStateChange, mockSelect, mockOrder } = vi.hoisted(() => ({
  mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  mockOnAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockSelect: vi.fn(),
  mockOrder: vi.fn(),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
    from: () => ({ select: mockSelect }),
  },
}))

const { useRoutes } = await import('./useRoutes')
const { useAuth } = await import('./useAuth')

beforeEach(() => {
  mockSelect.mockReset()
  mockOrder.mockReset()
  mockSelect.mockReturnValue({ order: mockOrder })
  mockOrder.mockResolvedValue({ data: [], error: null })
})

describe('useRoutes: columnas según sesión (nunca select "*")', () => {
  it('sin sesión pide exactamente COLUMNAS_PUBLICAS, sin user_id ni created_at', async () => {
    const { session } = useAuth()
    session.value = null

    const { fetchRutas } = useRoutes()
    await fetchRutas()

    expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_PUBLICAS.join(','))
    const columnasPedidas = mockSelect.mock.calls[0]?.[0] as string
    expect(columnasPedidas).not.toContain('user_id')
    expect(columnasPedidas).not.toContain('created_at')
    expect(columnasPedidas).not.toBe('*')
  })

  it('con sesión pide COLUMNAS_SESION (incluye user_id y created_at)', async () => {
    const { session } = useAuth()
    session.value = { user: { id: 'user-1' } } as unknown as Session

    const { fetchRutas } = useRoutes()
    await fetchRutas()

    expect(mockSelect).toHaveBeenCalledWith(COLUMNAS_SESION.join(','))
    const columnasPedidas = mockSelect.mock.calls[0]?.[0] as string
    expect(columnasPedidas).toContain('user_id')
    expect(columnasPedidas).toContain('created_at')
    expect(columnasPedidas).not.toBe('*')
  })
})
