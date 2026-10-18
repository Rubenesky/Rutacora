import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

const session = ref<Session | null>(null)
const isReady = ref(false)
let initialized = false

function init() {
  if (initialized) return
  initialized = true

  void supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
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
