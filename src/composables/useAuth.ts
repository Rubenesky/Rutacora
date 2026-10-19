import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

const session = ref<Session | null>(null)
const isReady = ref(false)
let initialized = false

function init() {
  if (initialized) return
  initialized = true

  // supabase-js ya conserva la sesión guardada ante un fallo de RED al
  // refrescar el token (solo la borra ante un rechazo EXPLÍCITO del
  // servidor, p. ej. refresh_token inválido/revocado) — ver GoTrueClient:
  // _callRefreshToken distingue isAuthRetryableFetchError (red) de un
  // AuthError no reintentable antes de llamar a _removeSession(). El
  // .catch() de abajo es solo una defensa adicional: si getSession()
  // rechazara por algo inesperado (no debería, pero no está documentado
  // como imposible), isReady igualmente pasa a true en vez de quedarse
  // colgado para siempre y bloquear fetchRutas() (que espera a isReady
  // antes de pedir las rutas), dejando la app sin arrancar sin red.
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      session.value = data.session
    })
    .catch(() => {
      session.value = null
    })
    .finally(() => {
      isReady.value = true
    })

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
  })
}

init()

async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function logout() {
  await supabase.auth.signOut()
}

export function useAuth() {
  return { session, isReady, login, logout }
}
