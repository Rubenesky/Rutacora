import { defineConfig } from '@vite-pwa/assets-generator/config'

// Genera todos los iconos de la PWA a partir de un único SVG fuente:
// public/favicon.svg (el mismo icono de montañas de la barra superior, con
// su fondo verde ya incluido). El margen adicional del icono maskable se
// añade aquí, no en el SVG, para controlar con precisión la "zona segura"
// del 80% que exige esa variante.
//
// Ejecutar con: npm run generate-pwa-assets
// (regenera los PNG/ICO en public/; no se ejecuta en cada build, solo
// cuando cambia el icono fuente).
export default defineConfig({
  images: ['public/favicon.svg'],
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']],
      // Sin margen extra: el SVG fuente ya incluye su propio fondo y
      // margen (ver public/icon-source.svg).
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#1b5e20' },
    },
    maskable: {
      sizes: [512],
      // 0.1 de margen adicional a cada lado = el icono ocupa el 80%
      // central ("zona segura" maskable de Android/Chrome). Mismo verde
      // que el fondo ya incluido en el SVG fuente: no deja costura.
      padding: 0.1,
      resizeOptions: { fit: 'contain', background: '#1b5e20' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#1b5e20' },
    },
  },
})
