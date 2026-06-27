import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vuetify: ['vuetify'],
          pdfjs: ['pdfjs-dist'],
          vendor: ['vue', 'vue-router', 'pinia', 'dayjs']
        }
      }
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 5173
  }
})
