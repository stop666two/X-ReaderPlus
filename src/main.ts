import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import './services/api-bridge'  // Go HTTP backend API
import { initDb } from './services/db'
import { useThemeStore } from './stores/theme'
import { useSettingsStore } from './stores/settings'
import './style.css'

async function bootstrap() {
  await initDb()

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)
  app.use(vuetify)
  app.use(i18n)

  // Load persisted settings
  const themeStore = useThemeStore()
  await themeStore.load()

  const settingsStore = useSettingsStore()
  await settingsStore.load()

  app.mount('#app')
}

bootstrap().catch(console.error)
