import { describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from './useInstallPrompt'

function dispararBeforeInstallPrompt() {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<unknown>
  }
  evento.prompt = vi.fn(() => Promise.resolve())
  evento.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(evento)
  return evento
}

describe('useInstallPrompt', () => {
  it('sin beforeinstallprompt todavía, el botón no está disponible', () => {
    const { disponible } = useInstallPrompt()
    expect(disponible.value).toBe(false)
  })

  it('tras beforeinstallprompt, el botón está disponible; instalar() llama a prompt()', async () => {
    const evento = dispararBeforeInstallPrompt()
    const { disponible, instalar } = useInstallPrompt()

    expect(disponible.value).toBe(true)

    await instalar()
    expect(evento.prompt).toHaveBeenCalled()
  })

  it('appinstalled oculta el botón (ya no tiene sentido ofrecer instalar)', () => {
    dispararBeforeInstallPrompt()
    const { disponible } = useInstallPrompt()
    expect(disponible.value).toBe(true)

    window.dispatchEvent(new Event('appinstalled'))

    expect(disponible.value).toBe(false)
  })
})
