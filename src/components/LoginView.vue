<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { APP_NAME } from '@/config'

const { login } = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await login(email.value.trim(), password.value)
  } catch {
    errorMessage.value = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <h1>{{ APP_NAME }}</h1>
    <form
      class="login-form"
      @submit.prevent="onSubmit"
    >
      <label for="email">Correo</label>
      <input
        id="email"
        v-model="email"
        type="email"
        inputmode="email"
        autocomplete="username"
        required
        :disabled="isSubmitting"
      >

      <label for="password">Contraseña</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        :disabled="isSubmitting"
      >

      <p
        v-if="errorMessage"
        class="error"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  max-width: 360px;
}

label {
  font-weight: 600;
}

input {
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
}

button[type='submit'] {
  margin-top: var(--space-1);
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

button[type='submit']:disabled {
  background: var(--color-border);
  cursor: not-allowed;
}

.error {
  color: var(--color-danger);
  margin: 0;
}
</style>
