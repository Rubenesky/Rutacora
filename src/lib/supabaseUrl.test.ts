import { describe, expect, it, vi } from 'vitest'
import { normalizeSupabaseUrl } from './supabaseUrl'

describe('normalizeSupabaseUrl', () => {
  it('deja igual una URL que ya es solo el origen', () => {
    expect(normalizeSupabaseUrl('https://xxx.supabase.co')).toBe('https://xxx.supabase.co')
  })

  it('normaliza una URL con ruta /rest/v1 y avisa en consola', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(normalizeSupabaseUrl('https://xxx.supabase.co/rest/v1')).toBe(
      'https://xxx.supabase.co',
    )
    expect(warnSpy).toHaveBeenCalledOnce()

    warnSpy.mockRestore()
  })

  it('normaliza una URL con barra final y avisa en consola', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(normalizeSupabaseUrl('https://xxx.supabase.co/')).toBe('https://xxx.supabase.co')
    expect(warnSpy).toHaveBeenCalledOnce()

    warnSpy.mockRestore()
  })

  it('no avisa si la URL ya es correcta', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    normalizeSupabaseUrl('https://xxx.supabase.co')
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('lanza un error claro si la URL no es válida', () => {
    expect(() => normalizeSupabaseUrl('no-es-una-url')).toThrow(/VITE_SUPABASE_URL/)
  })
})
