import { describe, expect, it } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('escapa etiquetas y comillas', () => {
    expect(escapeHtml('<script>alert("hola")</script>')).toBe(
      '&lt;script&gt;alert(&quot;hola&quot;)&lt;/script&gt;',
    )
  })

  it('deja intacto el texto normal', () => {
    expect(escapeHtml('Ruta del Cares')).toBe('Ruta del Cares')
  })
})
