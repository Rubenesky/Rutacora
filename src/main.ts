import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { exponerHerramientasDesarrollo } from './devtools'

createApp(App).mount('#app')

if (import.meta.env.DEV) {
  exponerHerramientasDesarrollo()
}
