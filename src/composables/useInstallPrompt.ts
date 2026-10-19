import { computed, ref } from 'vue'

// Evento no estándar (solo Chrome/Edge/Android; Safari/iOS no lo dispara
// nunca, así que ahí el botón sencillamente no aparece: "sin molestar si no
// se soporta").
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const eventoDiferido = ref<BeforeInstallPromptEvent | null>(null)
const yaInstalada = ref(false)

function enModoStandalone(): boolean {
  // matchMedia no existe en jsdom (entorno de test) ni, en teoría, en algún
  // navegador antiguo: se trata igual que "no estoy en standalone", no como
  // un error (el botón de instalar simplemente no aparecerá si tampoco hay
  // evento beforeinstallprompt, que es lo normal en esos casos).
  const porMediaQuery =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  // Safari/iOS antiguo: propiedad no estándar, sin tipo en lib.dom.
  const porSafariIOS = (navigator as unknown as { standalone?: boolean }).standalone === true
  return porMediaQuery || porSafariIOS
}

let inicializado = false
function init(): void {
  if (inicializado) return
  inicializado = true

  yaInstalada.value = enModoStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    eventoDiferido.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('appinstalled', () => {
    yaInstalada.value = true
    eventoDiferido.value = null
  })
}
init()

async function instalar(): Promise<void> {
  const evento = eventoDiferido.value
  if (!evento) return
  await evento.prompt()
  await evento.userChoice
  // El evento solo se puede usar una vez; si el usuario lo rechaza, Chrome
  // no vuelve a dispararlo hasta pasado un tiempo (no hay forma de
  // forzarlo). Se oculta el botón hasta el siguiente beforeinstallprompt.
  eventoDiferido.value = null
}

export function useInstallPrompt() {
  // No se muestra el botón si no hay evento diferido disponible (navegador
  // sin soporte, o Chrome todavía no lo ha ofrecido), o si la app ya está
  // instalada (display-mode: standalone).
  const disponible = computed(() => eventoDiferido.value !== null && !yaInstalada.value)
  return { disponible, instalar }
}
