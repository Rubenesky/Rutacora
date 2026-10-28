<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useFocusTrap } from '@/composables/useFocusTrap'

const emit = defineEmits<{
  cerrar: []
}>()

const { login } = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

// Atrapa Tab/Shift+Tab dentro del diálogo y devuelve el foco al botón que
// lo abrió al cerrarse (antes se escapaba al mapa de fondo). App.vue monta
// y desmonta este componente con v-if, así que mientras exista está
// siempre abierto: "activo" puede ser un ref(true) fijo.
const dialogoRef = ref<HTMLElement | null>(null)
useFocusTrap(dialogoRef, ref(true))

async function onSubmit(): Promise<void> {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await login(email.value.trim(), password.value)
    emit('cerrar')
  } catch {
    errorMessage.value = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    ref="dialogoRef"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Iniciar sesión"
  >
    <div class="modal-sheet">
      <header class="modal-header">
        <h2>Iniciar sesión</h2>
        <button
          type="button"
          class="modal-cerrar"
          aria-label="Cerrar"
          @click="emit('cerrar')"
        >
          ✕
        </button>
      </header>

      <form
        class="modal-form"
        @submit.prevent="onSubmit"
      >
        <label for="login-email">Correo</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="username"
          required
          :disabled="isSubmitting"
        >

        <label for="login-password">Contraseña</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          :disabled="isSubmitting"
        >

        <p
          v-if="errorMessage"
          class="campo-error"
          role="alert"
        >
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="boton-primario"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.modal-sheet {
  background: var(--color-surface);
  border-radius: var(--radius) var(--radius) 0 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  .modal-overlay {
    align-items: center;
    justify-content: center;
  }

  .modal-sheet {
    border-radius: var(--radius);
    width: 100%;
    max-width: 360px;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-cerrar {
  min-width: 44px;
  background: transparent;
  font-size: 18px;
}

.modal-form {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.modal-form label {
  font-weight: 600;
  margin-top: var(--space-1);
}

.modal-form input {
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
}

.boton-primario {
  margin-top: var(--space-1);
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.boton-primario:disabled {
  background: var(--color-border);
  cursor: not-allowed;
}

.campo-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}
</style>
